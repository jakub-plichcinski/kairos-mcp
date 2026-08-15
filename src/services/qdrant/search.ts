import { QdrantConnection } from './connection.js';
import { embeddingService } from '../embedding/service.js';
import { logger } from '../../utils/structured-logger.js';
import { qdrantOperations, qdrantQueryDuration } from '../metrics/qdrant-metrics.js';
import { getTenantId, getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';

/**
 * searchMemory - vector similarity search wrapper
 */
export async function searchMemory(conn: QdrantConnection, query: string, limit?: number, domain?: string) {
  return conn.executeWithReconnect(async () => {
    const tenantId = getTenantId();
    const timer = qdrantQueryDuration.startTimer({ tenant_id: tenantId });
    
    try {
      const limitVal = limit || 10;
      logger.debug(`searchMemory called query="${query.slice(0, 80)}..." domain=${domain || 'all'} limit=${limitVal}`);
      const queryEmbeddingResult = await embeddingService.generateEmbedding(query);
      const queryVector = queryEmbeddingResult.embedding;
      logger.debug(`Query embedding generated, length=${queryVector.length}`);

      const allowedSpaceIds = getSpaceContext().allowedSpaceIds;
      const domainFilter = domain ? { must: [{ key: 'domain', match: { value: domain } }] } : undefined;
      const filter = buildSpaceFilter(allowedSpaceIds, domainFilter);

      const searchParams: any = {
        query: queryVector,
        using: `vs${queryVector.length}`,
        limit: limitVal,
        filter,
        params: { quantization: { rescore: conn.rescoreEnabled } }
      };

      logger.debug(`[Qdrant][search] collection=${conn.collectionName} req=${JSON.stringify(searchParams)}`);
      const searchResult = (await conn.client.query(conn.collectionName, searchParams))?.points ?? [];
      logger.debug(`Qdrant search returned ${searchResult?.length || 0} results`);
      
      qdrantOperations.inc({ 
        operation: 'search', 
        status: 'success',
        tenant_id: tenantId 
      });
      
      timer({ tenant_id: tenantId });

    if (searchResult && searchResult.length > 0) {
      return searchResult.map((result: any) => {
        const payload = result.payload as any;
        return {
          id: result.id.toString(),
          description: payload.label || 'Memory',
          content: typeof payload.text === 'string' ? payload.text : '',
          confidence: result.score,
          relevance: result.score,
          domain: payload.domain || 'general',
          task: payload.task || 'search_result',
          type: payload.type || 'context',
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          created_at: typeof payload.created_at === 'string' ? payload.created_at : new Date().toISOString(),
          protocol: payload.protocol,
          uri: payload.uri,
          memory_uuid: result.id.toString(),
          step_number: payload.protocol?.step,
          quality_metadata: payload.quality_metadata || {
            step_quality_score: 1,
            step_quality: 'standard'
          }
        };
      });
    }
    return [];
    } catch (error) {
      qdrantOperations.inc({ 
        operation: 'search', 
        status: 'error',
        tenant_id: tenantId 
      });
      timer({ tenant_id: tenantId });
      throw error;
    }
  });
}