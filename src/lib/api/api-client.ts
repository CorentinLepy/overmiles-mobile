/** Contract reserved for the centralized network layer implemented in COR-55. */
export type ApiRequest = Readonly<{
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}>;

export interface ApiClient {
  request<TResponse>(request: ApiRequest): Promise<TResponse>;
}
