export interface RenderContext {
  site: any;
  settings: any;
  theme: any;
  hero: any;
  about: any;
  cta: any;
  logo: any;
  favicon: any;
  homepageSections: any[];
  pages: any[];
  services: any[];
  projects: any[];
  news: any[];
  vacancies: any[];
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
