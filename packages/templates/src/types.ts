export interface RenderContext {
  site: any;
  settings: any;
  pages: any[];
  services: any[];
  projects: any[];
  news: any[];
  menu: any[];
  mediaMap: Map<string, any>;
  route: string;
  subRoute?: string;
}

export interface Template {
  id: string;
  name: string;
  render(ctx: RenderContext): string;
}
