/** İstemci isteklerinde tarayıcı/Next önbelleğini atla. */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
}
