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
    requestId?: string,
    adminUsername?: string,
  ): Promise<UpdateConfigResult>;
  checkAdminRole(userId: string, requiredRole?: string): Promise<boolean>;
}

export class SupabaseConfigStore implements ConfigStore {
  private readonly fetcher: typeof fetch;
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.fetcher = (...args: Parameters<typeof fetch>) => fetcher(...args);
  }

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
      redirect: 'manual',
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

  async checkAdminRole(
    userId: string,
    requiredRole: string = 'superadmin',
  ): Promise<boolean> {
    try {
      const data = await this.rpc('empire_admin_check_role', {
        p_user_id: userId,
        p_required_role: requiredRole,
      });
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async updateConfig(
    key: string,
    value: unknown,
    adminUserId?: string,
    reason?: string,
    requestId?: string,
    adminUsername?: string,
  ): Promise<UpdateConfigResult> {
    let data: (UpdateConfigResult & { error?: string }) | undefined;
    try {
      data = (await this.rpc('empire_admin_update_config', {
        p_key: key,
        p_value: value,
        p_admin_user_id: adminUserId ?? null,
        p_reason: reason ?? null,
        p_request_id: requestId ?? null,
        p_admin_username: adminUsername ?? null,
      })) as UpdateConfigResult & { error?: string };
    } catch {
      // Graceful fallback to empire_config_update
      data = (await this.rpc('empire_config_update', {
        p_key: key,
        p_value: value,
        p_admin_user_id: adminUserId ?? null,
        p_reason: reason ?? null,
      })) as UpdateConfigResult & { error?: string };
    }

    if (data?.error) {
      throw new Error(data.error);
    }
    return data!;
  }
}
