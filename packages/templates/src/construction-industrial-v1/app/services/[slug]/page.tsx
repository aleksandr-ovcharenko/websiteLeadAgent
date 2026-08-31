import { DetailPage } from '@/components/contractor-site'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <DetailPage kind="service" slug={slug} /> }
