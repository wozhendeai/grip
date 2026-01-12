'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Send } from 'lucide-react';

interface TipDialogProps {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  children?: React.ReactNode;
}

export function TipDialog({ username, name, avatarUrl, children }: TipDialogProps) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  const displayName = name || username;

  const triggerButton = children ? (
    children
  ) : (
    <Button variant="outline" size="sm" className="gap-2">
      <DollarSign className="size-4" />
      Tip
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger render={triggerButton as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tip @{username}</DialogTitle>
          <DialogDescription>Send a direct payment to this contributor</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <Avatar className="size-10">
              <AvatarImage src={avatarUrl || undefined} alt={username} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{displayName}</div>
              <div className="text-sm text-muted-foreground">@{username}</div>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="tip-amount">Amount</FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <span className="text-sm text-muted-foreground">$</span>
              </InputGroupAddon>
              <InputGroupInput
                id="tip-amount"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </InputGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="tip-message">Message (optional)</FieldLabel>
            <Textarea
              id="tip-message"
              placeholder="Thanks for your great work!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button disabled className="gap-2" title="Coming soon">
            <Send className="size-4" />
            Send Tip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
