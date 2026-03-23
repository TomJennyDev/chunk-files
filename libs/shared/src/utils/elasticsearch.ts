import { Client, ClientOptions } from '@elastic/elasticsearch';
import { Logger } from '@nestjs/common';
import { retryWithBackoff } from './retry';

export interface ElasticsearchConnectionConfig {
  node: string;
  maxRetries?: number;
  requestTimeout?: number;
}

/**
 * Build standardized Elasticsearch client options.
 */
export function buildElasticsearchOptions(
  config: ElasticsearchConnectionConfig,
): ClientOptions {
  return {
    node: config.node,
    maxRetries: config.maxRetries || 5,
    requestTimeout: config.requestTimeout || 30000,
    tls: { rejectUnauthorized: false },
    sniffOnStart: false,
    sniffOnConnectionFault: false,
  };
}

/**
 * Create an Elasticsearch client and wait for the cluster to be reachable.
 * Uses exponential backoff to handle startup ordering.
 */
export async function createElasticsearchClient(
  config: ElasticsearchConnectionConfig,
  label = 'Elasticsearch',
): Promise<Client> {
  const logger = new Logger(`${label}:Connection`);
  const options = buildElasticsearchOptions(config);
  const client = new Client(options);

  await retryWithBackoff(
    async () => {
      const health = await client.cluster.health({});
      logger.log(
        `${label} cluster "${health.cluster_name}" status: ${health.status}`,
      );
      if (health.status === 'red') {
        throw new Error(`Cluster status is RED`);
      }
    },
    {
      maxRetries: 15,
      initialDelayMs: 2000,
      maxDelayMs: 15000,
      backoffMultiplier: 1.5,
    },
    label,
  );

  return client;
}
