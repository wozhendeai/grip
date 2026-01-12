'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { OrgSpendingData } from '@/db/queries/org-dashboard';

interface OrgSpendingCardProps {
  spending: OrgSpendingData;
  orgSlug: string;
}

function formatCurrency(amount: bigint): string {
  const dollars = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function OrgSpendingCard({ spending, orgSlug }: OrgSpendingCardProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate percentages for the budget bar
  const total = spending.spent + spending.reserved;
  const spentPercent = total > 0n ? Number((spending.spent * 100n) / total) : 0;
  const reservedPercent = total > 0n ? Number((spending.reserved * 100n) / total) : 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Organization Spending</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track budget allocation and spending
            </p>
          </div>
          <Link
            href={`/${orgSlug}/settings/wallet`}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage
            <ChevronRight className="size-4 ml-0.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">{spending.utilizationPercent}%</p>
              </div>
            </div>

            {/* Budget bar */}
            <div className="space-y-2">
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="bg-foreground h-full transition-all"
                  style={{ width: `${spentPercent}%` }}
                />
                <div
                  className="bg-muted-foreground/40 h-full transition-all"
                  style={{ width: `${reservedPercent}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-foreground" />
                  Spent ({formatCurrency(spending.spent)})
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-muted-foreground/40" />
                  Reserved ({formatCurrency(spending.reserved)})
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            {spending.memberSpending.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No team spending data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {spending.memberSpending.slice(0, 5).map((member) => (
                  <div key={member.userId} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={member.avatar ?? ''} alt={member.userName} />
                      <AvatarFallback className="text-xs">
                        {member.userName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.userName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(member.spent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <p className="text-sm text-muted-foreground text-center py-4">
              Spending activity coming soon.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
