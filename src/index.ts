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
                name: 'check_system_errors',
                description: 'Check most recent system error logs (lslog)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Number of logs to retrieve (default: 10)',
                        },
                    },
                },
            },
            {
                name: 'create_volume',
                description: 'Create a new volume (mkvdisk)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pool: {
                            type: 'string',
                            description: 'Name of the MDisk group (storage pool)',
                        },
                        size: {
                            type: 'number',
                            description: 'Size of the volume',
                        },
                        unit: {
                            type: 'string',
                            enum: ['gb', 'tb', 'mb'],
                            description: 'Unit for the size',
                        },
                        name: {
                            type: 'string',
                            description: 'Name of the new volume',
                        },
                    },
                    required: ['pool', 'size', 'unit', 'name'],
                },
            },
            {
                name: 'create_flashcopy_mapping',
                description: 'Create a FlashCopy mapping (mkfcmap)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        source: {
                            type: 'string',
                            description: 'Name or ID of the source volume',
                        },
                        target: {
                            type: 'string',
                            description: 'Name or ID of the target volume',
                        },
                        name: {
                            type: 'string',
                            description: 'Name for the new FlashCopy mapping',
                        },
                    },
                    required: ['source', 'target', 'name'],
                },
            },
            {
                name: 'start_flashcopy',
                description: 'Start a FlashCopy mapping (startfcmap -prep)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Name or ID of the FlashCopy mapping to start',
                        },
                    },
                    required: ['name'],
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

            case 'check_system_errors': {
                const args = request.params.arguments as { limit?: number } | undefined;
                const limit = args?.limit || 10;
                // lslog -order id means order by ID, usually ascending? No, usually we want recent.
                // Standard lslog without arguments usually shows recent first or lists them.
                // Depending on SVC version, `lslog` might list errors.
                // Let's use `lslog -order id` as in plan, but assume it might need adjustment if ordering is reversed.
                // Actually `lslog` lists cluster error log.
                const command = `lslog -order id -limit ${limit}`;
                const result = await svcClient.executeCommand(command);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                    ],
                };
            }

            case 'create_volume': {
                const args = request.params.arguments as {
                    pool: string;
                    size: number;
                    unit: string;
                    name: string;
                };
                // mkvdisk -mdiskgrp <pool> -size <size> -unit <unit> -name <name>
                const command = `mkvdisk -mdiskgrp ${args.pool} -size ${args.size} -unit ${args.unit} -name ${args.name}`;
                const result = await svcClient.executeCommand(command);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                    ],
                };
            }

            case 'create_flashcopy_mapping': {
                const args = request.params.arguments as {
                    source: string;
                    target: string;
                    name: string;
                };
                // mkfcmap -source <source> -target <target> -name <name>
                const command = `mkfcmap -source ${args.source} -target ${args.target} -name ${args.name}`;
                const result = await svcClient.executeCommand(command);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                    ],
                };
            }

            case 'start_flashcopy': {
                const args = request.params.arguments as { name: string };
                // startfcmap -prep <name>
                const command = `startfcmap -prep ${args.name}`;
                const result = await svcClient.executeCommand(command);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result, // startfcmap usually has no output on success, or a task ID
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
