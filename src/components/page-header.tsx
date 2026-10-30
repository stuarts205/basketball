import React from "react";

// A page's title and subtitle, styled to stand out on the court background,
// with optional controls on the right of the same row (they wrap underneath
// on narrow screens).
export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
    <div className="flex min-w-0 gap-3 [text-shadow:0_1px_0_rgb(255_255_255/0.7)]">
      <div aria-hidden className="w-1.5 shrink-0 rounded-full bg-ball-500" />
      <div className="min-w-0">
        <h1 className="text-3xl font-black tracking-tight text-sideline-900 sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-base font-semibold text-gray-700">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {actions}
  </div>
);
