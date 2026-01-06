import { Client, ConnectConfig } from 'ssh2';
import * as dotenv from 'dotenv';
import * as http from 'http';

dotenv.config();

export interface SvcConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    proxyHost?: string;
    proxyPort?: number;
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
            if (!this.config.proxyHost || !this.config.proxyPort) {
                return resolve(undefined);
            }

            const req = http.request({
                host: this.config.proxyHost,
                port: this.config.proxyPort,
                method: 'CONNECT',
                path: `${this.config.host}:${this.config.port || 22}`,
            });

            req.on('connect', (res, socket, head) => {
                if (res.statusCode === 200) {
                    resolve(socket);
                } else {
                    reject(new Error(`Proxy connection failed: ${res.statusCode} ${res.statusMessage}`));
                }
            });

            req.on('error', (err) => {
                reject(new Error(`Proxy request error: ${err.message}`));
            });

            req.end();
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
