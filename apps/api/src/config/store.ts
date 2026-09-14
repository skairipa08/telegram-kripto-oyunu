export interface UpdateConfigResult {
  success: boolean;
  key: string;
  updatedValue: unknown;
  auditLogId: string;
}

export interface ConfigStore {
  getConfig(): Promise<Record<string, unknown>>;
  updateConfig(
    key: string,
    value: unknown,
    adminUserId?: string,
    reason?: string,
  ): Promise<UpdateConfigResult>;
}

export class SupabaseConfigStore implements ConfigStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async rpc(
    name: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(
        `Database RPC ${name} failed with status ${response.status}`,
      );
    }
    return response.json();
  }

  async getConfig(): Promise<Record<string, unknown>> {
    const data = await this.rpc('empire_config_get', {});
    return (data as Record<string, unknown>) ?? {};
  }

  async updateConfig(
    key: string,
    value: unknown,
    adminUserId?: string,
    reason?: string,
  ): Promise<UpdateConfigResult> {
    const data = (await this.rpc('empire_config_update', {
      p_key: key,
      p_value: value,
      p_admin_user_id: adminUserId ?? null,
      p_reason: reason ?? null,
    })) as UpdateConfigResult & { error?: string };

    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }
}
