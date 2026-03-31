import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
}

export function Card({
  variant = 'default',
  className = '',
  children,
  ...props
}: CardProps) {
  const base = 'rounded-xl bg-card text-card-foreground overflow-hidden'
  const variants = {
    default: 'border border-border',
    bordered: 'border-2 border-border',
    elevated: 'shadow-lg',
  }
  return (
    <div className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  )
}

Card.Header = function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-b border-border ${className}`} {...props}>
      {children}
    </div>
  )
}

Card.Body = function CardBody({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-t border-border ${className}`} {...props}>
      {children}
    </div>
  )
}
