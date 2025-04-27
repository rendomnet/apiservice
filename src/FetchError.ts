export class FetchError extends Error {
  name: string = 'FetchError';
  status: number;
  code: string;
  message: string;
  data: any;

  constructor(response: Response, data: any = {}, code: string = 'FETCH_ERROR') {
    super();
    const defaultMessage = 'An unspecified error occurred';

    const getMessage = (data: any, locations: string[]): string | null =>
      locations
        .map((item) => {
          const parts = item.split('.');
          let value = data;
          for (const part of parts) {
            value = value?.[part];
          }
          return value;
        })
        .find((message) => typeof message === 'string') || null;

    const messageFromData = getMessage(data, [
      'error.errors.0.message',
      'error.message',
      'message',
    ]);

    this.message = messageFromData || response.statusText || defaultMessage;
    this.status = response.status;
    this.code = code;
    this.data = data;
    this.message = this.message || defaultMessage;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
