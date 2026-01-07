#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ErrorCode,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SvcClient, SvcConfig } from './svc-client.js';
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const config: SvcConfig = {
    host: process.env.SVC_HOST || '',
    port: parseInt(process.env.SVC_PORT || '22'),
    username: process.env.SVC_USERNAME || 'superuser',
    password: process.env.SVC_PASSWORD,
    privateKey: process.env.SVC_PRIVATE_KEY_PATH,
    proxyHost: process.env.SVC_PROXY_HOST,
    proxyPort: process.env.SVC_PROXY_PORT ? parseInt(process.env.SVC_PROXY_PORT) : undefined,
    proxyUsername: process.env.SVC_PROXY_USERNAME,
    proxyPassword: process.env.SVC_PROXY_PASSWORD,
    proxyPrivateKey: process.env.SVC_PROXY_PRIVATE_KEY_PATH,
};

const svcClient = new SvcClient(config);

const server = new Server(
    {
        name: 'svc-mcp-server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'check_system_status',
                description: 'Check SVC system status (lssystem)',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'execute_svc_command',
                description: 'Execute any SVC CLI command. This is a generic tool that allows you to run any SVC command directly.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'The SVC CLI command to execute (e.g., "lsvdisk", "lshost", "mkvdisk -mdiskgrp pool0 -size 10 -unit gb -name vol1")',
                        },
                    },
                    required: ['command'],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!config.host) {
        throw new McpError(ErrorCode.InternalError, 'SVC_HOST is not configured.');
    }

    try {
        switch (request.params.name) {
            case 'check_system_status': {
                const result = await svcClient.executeCommand('lssystem');
                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                    ],
                };
            }

            case 'execute_svc_command': {
                const args = request.params.arguments as { command: string };
                if (!args.command || args.command.trim() === '') {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        'Command parameter is required and cannot be empty'
                    );
                }
                const result = await svcClient.executeCommand(args.command);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                    ],
                };
            }

            default:
                throw new McpError(
                    ErrorCode.MethodNotFound,
                    `Unknown tool: ${request.params.name}`
                );
        }
    } catch (error: any) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error executing command: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('SVC MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
