export function deserializeForm(src: any): FormData {
  const fd = new FormData();
  switch (src.cls) {
    case 'FormData': {
      for (const [key, items] of src.value) {
        for (const item of items) {
          let deserializedItem = deserializeForm(item);
          if (deserializedItem instanceof FormData) {
            // Use a workaround for TypeScript FormData entries() issue
            const entries = deserializedItem as any;
            for (const [subKey, subValue] of entries.entries()) {
              fd.append(`${key}[${subKey}]`, subValue);
            }
          } else {
            fd.append(key, deserializedItem);
          }
        }
      }
      break;
    }
    case 'Blob':
    case 'File': {
      const { type, name, lastModified } = src;
      const binStr = atob(src.value);
      const arr = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
      const data = [arr.buffer];
      const fileOrBlob =
        src.cls === 'File'
          ? new File(data, name, { type, lastModified })
          : new Blob(data, { type });
      fd.append('file', fileOrBlob);
      break;
    }
    case 'json': {
      fd.append('json', JSON.stringify(JSON.parse(src.value)));
      break;
    }
    default:
      throw new Error('Unsupported type for deserialization');
  }
  return fd;
}
