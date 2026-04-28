/**
 * Console Card primitive.
 *
 * Anatomy: <Card> > <CardHeader> > <CardTitle/CardDescription>; <CardBody>; <CardFooter>.
 * All server components. Pure Tailwind, zero deps.
 */
import { cn } from './cn'

export function Card({
  className,
  interactive,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 bg-white shadow-sm',
        interactive && 'transition hover:shadow-md hover:border-gray-300',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pb-3', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-gray-900 tracking-tight', className)} {...rest} />
  )
}

export function CardDescription({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-gray-500', className)} {...rest} />
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('p-5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2', className)}
      {...rest}
    />
  )
}
