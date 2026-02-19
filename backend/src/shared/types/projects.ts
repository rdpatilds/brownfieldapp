export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProject {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  isPublic?: boolean;
  ownerId: string;
}
