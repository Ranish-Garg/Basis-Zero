import Link from "next/link"
import { Github, Twitter } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t border-border/50 bg-card/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Brand */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                                <span className="font-mono text-sm font-bold">BZ</span>
                            </div>
                            <span className="font-mono text-sm font-semibold tracking-tight">
                                Basis<span className="text-primary">Zero</span>
                            </span>
                        </Link>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Zero Opportunity Cost Prediction Market. Trade using yield, protect your principal.
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="font-mono text-xs uppercase tracking-wider text-primary mb-4">
                            Product
                        </h4>
                        <ul className="space-y-2">
                            {[
                                { href: "/trade", label: "Trade" },
                                { href: "/vault", label: "Vault" },
                                { href: "/profile", label: "Profile" },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="font-mono text-xs uppercase tracking-wider text-primary mb-4">
                            Resources
                        </h4>
                        <ul className="space-y-2">
                            {[
                                { href: "#", label: "Documentation" },
                                { href: "#", label: "API" },
                                { href: "#", label: "FAQ" },
                            ].map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Connect */}
                    <div>
                        <h4 className="font-mono text-xs uppercase tracking-wider text-primary mb-4">
                            Connect
                        </h4>
                        <div className="flex items-center gap-4">
                            <a
                                href="#"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a
                                href="#"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Github className="h-5 w-5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        © 2026 Basis Zero. Powered by Circle Arc & Yellow Network.
                    </p>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            All systems operational
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
