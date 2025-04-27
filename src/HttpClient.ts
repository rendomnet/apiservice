import qs from 'qs';
import { ApiCallParams, Token } from './types';
import { FetchError } from './FetchError';
import { deserializeForm } from './form';

/**
 * Handles HTTP requests to external APIs
 */
export class HttpClient {
  /**
   * Make an HTTP request
   */
  public async makeRequest(apiParams: ApiCallParams, authToken: Token | Record<string, any>): Promise<any> {
    const {
      accountId,
      method,
      route,
      base,
      body,
      data,
      headers,
      queryParams,
      contentType = 'application/json',
      accessToken: forcedAccessToken,
      requireAuth = true,
      files,
    } = apiParams;
    
    // Build URL and request body
    const url = this.buildUrl(base, route, queryParams);
    const requestBody = body || data;
    const normalizedMethod = method?.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE';
    
    // Handle file uploads
    const formData = this.prepareFormData(files);
    
    // Create fetch options
    const fetchOptions = this.buildFetchOptions({
      method: normalizedMethod,
      body: requestBody,
      formData,
      contentType,
      authToken,
      forcedAccessToken,
      requireAuth,
      headers,
    });

    // Make the request
    try {
      console.log(`🔄 Making API call to ${url}`);
      const response = await fetch(url, fetchOptions);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('🔄 Error making API call:', error);
      throw error;
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(base: string, route?: string, queryParams?: URLSearchParams): string {
    let url = `${base}${route || ''}`;
    if (queryParams) url += `?${qs.stringify(queryParams)}`;
    return url;
  }

  /**
   * Prepare form data for file uploads
   */
  private prepareFormData(files?: File[]): FormData | null {
    if (!files) return null;
    
    const formData = deserializeForm(files);
    for (let [key, value] of formData.entries()) {
      console.log(`formdata ${key}:`, value);
    }
    return formData;
  }

  /**
   * Build fetch options for request
   */
  private buildFetchOptions({
    method,
    body,
    formData,
    contentType,
    authToken,
    forcedAccessToken,
    requireAuth,
    headers,
  }: {
    method: string;
    body: any;
    formData: FormData | null;
    contentType: string;
    authToken: any;
    forcedAccessToken?: string;
    requireAuth: boolean;
    headers?: Record<string, string>;
  }): RequestInit {
    const allowedMethods = ['POST', 'PUT', 'PATCH'];
    
    return {
      method,
      headers: {
        ...(requireAuth && { 
          Authorization: `Bearer ${forcedAccessToken || authToken.access_token}` 
        }),
        ...(!formData && { 'content-type': contentType }),
        ...(headers || {}),
      },
      body: body && allowedMethods.includes(method) 
        ? JSON.stringify(body) 
        : (formData || null),
    };
  }

  /**
   * Handle API response
   */
  private async handleResponse(response: Response): Promise<any> {
    let data = null;
    try {
      data = await response.json();
      console.log('🔄 Response data:', data);
    } catch (error) {
      // Response wasn't JSON, continue with null data
    }
    
    if (!response.ok) {
      throw new FetchError(response, data);
    }
    
    return data;
  }
} 