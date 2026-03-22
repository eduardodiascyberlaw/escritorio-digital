export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export interface DriveAdapter {
  findClientFolder(name: string): Promise<string | null>;
  listFiles(folderId: string): Promise<DriveFile[]>;
  uploadFile(
    folderId: string,
    name: string,
    buffer: Buffer
  ): Promise<string>;
}

export class StubDriveAdapter implements DriveAdapter {
  async findClientFolder(): Promise<string | null> {
    console.log("[Drive Stub] Pesquisa de pasta — não implementado");
    return null;
  }

  async listFiles(): Promise<DriveFile[]> {
    console.log("[Drive Stub] Listar ficheiros — não implementado");
    return [];
  }

  async uploadFile(): Promise<string> {
    console.log("[Drive Stub] Upload — não implementado");
    return "stub_file_id";
  }
}
