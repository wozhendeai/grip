import { bounties, chainIdFilter, db, organization, user } from '@/db';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://usegrip.xyz';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
  ];

  // Fetch dynamic data in parallel
  const [publicBounties, publicOrgs, activeUsers] = await Promise.all([
    // Public bounties (open or completed, not cancelled)
    db
      .select({
        id: bounties.id,
        githubOwner: bounties.githubOwner,
        githubRepo: bounties.githubRepo,
        updatedAt: bounties.updatedAt,
      })
      .from(bounties)
      .where(and(chainIdFilter(bounties), eq(bounties.status, 'open')))
      .orderBy(desc(bounties.updatedAt))
      .limit(1000),

    // Public organizations
    db
      .select({
        slug: organization.slug,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .where(eq(organization.visibility, 'public'))
      .limit(500),

    // Users with activity (have GitHub linked)
    db
      .select({
        name: user.name,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(isNotNull(user.name))
      .limit(1000),
  ]);

  // Build bounty URLs (includes repo URLs implicitly)
  const bountyPages: MetadataRoute.Sitemap = publicBounties.map((bounty) => ({
    url: `${BASE_URL}/${bounty.githubOwner}/${bounty.githubRepo}/bounties/${bounty.id}`,
    lastModified: bounty.updatedAt ? new Date(bounty.updatedAt) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Extract unique repos from bounties
  const repoSet = new Set<string>();
  const repoPages: MetadataRoute.Sitemap = [];
  for (const bounty of publicBounties) {
    const repoKey = `${bounty.githubOwner}/${bounty.githubRepo}`;
    if (!repoSet.has(repoKey)) {
      repoSet.add(repoKey);
      repoPages.push({
        url: `${BASE_URL}/${bounty.githubOwner}/${bounty.githubRepo}`,
        lastModified: bounty.updatedAt ? new Date(bounty.updatedAt) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      });
    }
  }

  // Organization pages
  const orgPages: MetadataRoute.Sitemap = publicOrgs.map((org) => ({
    url: `${BASE_URL}/${org.slug}`,
    lastModified: org.createdAt ? new Date(org.createdAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // User profile pages
  const userPages: MetadataRoute.Sitemap = activeUsers
    .filter((u) => u.name) // Ensure name exists
    .map((u) => ({
      url: `${BASE_URL}/${u.name}`,
      lastModified: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

  return [...staticPages, ...bountyPages, ...repoPages, ...orgPages, ...userPages];
}
