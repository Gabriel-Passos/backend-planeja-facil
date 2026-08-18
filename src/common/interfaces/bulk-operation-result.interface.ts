export interface BulkOperationFailure {
  id: string;
  reason: string;
}

export interface BulkOperationResult {
  succeeded: string[];
  failed: BulkOperationFailure[];
}
