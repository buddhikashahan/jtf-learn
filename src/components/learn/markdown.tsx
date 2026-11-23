import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Safe Markdown renderer. react-markdown does not render raw HTML and
 * sanitises dangerous URL protocols (e.g. javascript:) by default.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-slate-100",
        "prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-ink prose-img:rounded-xl",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...props} {...(external && { target: "_blank", rel: "noopener noreferrer" })}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
