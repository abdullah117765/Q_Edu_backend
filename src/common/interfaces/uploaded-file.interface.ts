export interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  fieldname?: string;
  destination?: string;
  filename?: string;
  path?: string;
}

