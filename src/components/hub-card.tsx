import Link from "next/link";
import { Card } from "./card";
import { ArrowRight } from "lucide-react";
import type { ElementType, ReactNode } from "react";

export type HubCardItem = {
  href: string;
  icon: ElementType;
  title: string;
  description: string;
  sources?: string;
};

export function HubGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        columns === 3 ? "lg:grid-cols-3" : ""
      } gap-3`}
    >
      {children}
    </div>
  );
}

export function HubCard({ item }: { item: HubCardItem }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="group block">
      <Card className="h-full transition-colors hover:border-accent/30">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <Icon
              size={18}
              className="text-muted group-hover:text-accent transition-colors"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                {item.title}
              </h3>
              <ArrowRight
                size={12}
                className="text-muted group-hover:text-accent transition-colors shrink-0"
              />
            </div>
            <p className="text-xs text-muted mt-1 line-clamp-2">
              {item.description}
            </p>
            {item.sources && (
              <p className="text-[10px] font-mono text-muted/60 mt-1.5">
                {item.sources}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
