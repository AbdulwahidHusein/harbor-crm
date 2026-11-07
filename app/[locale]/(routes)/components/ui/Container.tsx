import Heading from "@/components/ui/heading";
import React from "react";

interface ContainerProps {
  title: string;
  description?: string;
  visibility?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard page frame: heading row, hairline divider, content.
 * Every module page renders through this so the product reads as one system.
 */
const Container = ({
  title,
  description,
  visibility,
  eyebrow,
  actions,
  children,
}: ContainerProps) => {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-1 flex-col">
      <Heading
        title={title}
        description={description}
        visibility={visibility}
        eyebrow={eyebrow}
        actions={actions}
      />
      <div className="my-5 h-px w-full bg-border" role="presentation" />
      <div className="min-h-0 w-full flex-1">{children}</div>
    </div>
  );
};

export default Container;
