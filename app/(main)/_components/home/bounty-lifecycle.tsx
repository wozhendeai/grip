// import { GitPullRequest, CircleDollarSign, CheckCircle2 } from 'lucide-react';

export function BountyLifecycle() {
  const steps = [
    {
      title: 'Fund Issue',
      description:
        'Add a crypto bounty to any GitHub issue. The funds are locked in a smart contract.',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Contribute',
      description:
        'Developers submit Pull Requests. No permission needed - just code and link the issue.',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Get Paid',
      description:
        "Maintainer merges the PR. Funds are released instantly to the contributor's wallet.",
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ];

  return (
    <section className="py-24">
      <div className="container">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
          <p className="text-lg text-muted-foreground">
            A transparent lifecycle powered by smart contracts.
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connecting Line (Desktop) */}
          <div className="absolute left-0 top-12 hidden h-0.5 w-full bg-border md:block" />

          {steps.map((step, index) => (
            <div key={step.title} className="relative bg-background pt-4 md:pt-0">
              {/* Icon */}
              <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm z-10">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.bg} ${step.color}`}
                >
                  {/* <step.icon className="h-6 w-6" /> */}
                </div>
              </div>

              {/* Content */}
              <div className="text-center px-4">
                <h3 className="mb-3 text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
