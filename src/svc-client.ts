import { Client, ConnectConfig } from 'ssh2';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

export interface SvcConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    proxyHost?: string;
    proxyPort?: number;
    proxyUsername?: string;
    proxyPassword?: string;
    proxyPrivateKey?: string;
}

export class SvcClient {
    private config: SvcConfig;

    constructor(config: SvcConfig) {
        this.config = config;
    }

    private getConnectionConfig(sock?: any): ConnectConfig {
        return {
            host: this.config.host,
            port: this.config.port || 22,
            username: this.config.username,
            password: this.config.password,
            privateKey: this.config.privateKey,
            readyTimeout: 20000,
            sock: sock,
        };
    }

    private async createProxyConnection(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.config.proxyHost) {
                return resolve(undefined);
            }

            const proxyClient = new Client();
            
            const proxyConfig: ConnectConfig = {
                host: this.config.proxyHost,
                port: this.config.proxyPort || 22,
                username: this.config.proxyUsername || 'root',
            };

            // SSH proxy authentication
            if (this.config.proxyPrivateKey) {
                try {
                    proxyConfig.privateKey = fs.readFileSync(this.config.proxyPrivateKey);
                } catch (err: any) {
                    return reject(new Error(`Failed to read proxy private key: ${err.message}`));
                }
            } else if (this.config.proxyPassword) {
                proxyConfig.password = this.config.proxyPassword;
            } else {
                return reject(new Error('Proxy authentication required: provide either proxyPassword or proxyPrivateKey'));
            }

            proxyClient.on('ready', () => {
                proxyClient.forwardOut(
                    '127.0.0.1',
                    0,
                    this.config.host,
                    this.config.port || 22,
                    (err, stream) => {
                        if (err) {
                            proxyClient.end();
                            return reject(new Error(`SSH tunnel failed: ${err.message}`));
                        }
                        resolve(stream);
                    }
                );
            }).on('error', (err) => {
                reject(new Error(`Proxy SSH connection failed: ${err.message}`));
            }).connect(proxyConfig);
        });
    }

    async executeCommand(command: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            let sock;
            try {
                sock = await this.createProxyConnection();
            } catch (err) {
                return reject(err);
            }

            const conn = new Client();

            conn.on('ready', () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }

                    let stdout = '';
                    let stderr = '';

                    stream.on('close', (code: number, signal: any) => {
                        conn.end();
                        if (code !== 0) {
                            reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
                        } else {
                            resolve(stdout.trim());
                        }
                    }).on('data', (data: any) => {
                        stdout += data;
                    }).stderr.on('data', (data: any) => {
                        stderr += data;
                    });
                });
            }).on('error', (err) => {
                reject(err);
            }).connect(this.getConnectionConfig(sock));
        });
    }
}
