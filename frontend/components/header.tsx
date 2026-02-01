'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, Variants } from 'framer-motion'
import { Home, TrendingUp, Vault, User, Wallet } from 'lucide-react'

// Navigation items for Basis Zero
interface NavMenuItem {
    icon: React.ReactNode
    label: string
    href: string
    gradient: string
    iconColor: string
}

const menuItems: NavMenuItem[] = [
    {
        icon: <Home className="h-5 w-5" />,
        label: "Home",
        href: "/",
        gradient: "radial-gradient(circle, rgba(6,182,212,0.2) 0%, rgba(8,145,178,0.08) 50%, rgba(14,116,144,0) 100%)",
        iconColor: "group-hover:text-cyan-400"
    },
    {
        icon: <TrendingUp className="h-5 w-5" />,
        label: "Trade",
        href: "/trade",
        gradient: "radial-gradient(circle, rgba(34,197,94,0.2) 0%, rgba(22,163,74,0.08) 50%, rgba(21,128,61,0) 100%)",
        iconColor: "group-hover:text-green-400"
    },
    {
        icon: <Vault className="h-5 w-5" />,
        label: "Vault",
        href: "/vault",
        gradient: "radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(147,51,234,0.08) 50%, rgba(126,34,206,0) 100%)",
        iconColor: "group-hover:text-purple-400"
    },
    {
        icon: <User className="h-5 w-5" />,
        label: "Profile",
        href: "/profile",
        gradient: "radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.08) 50%, rgba(217,119,6,0) 100%)",
        iconColor: "group-hover:text-amber-400"
    },
]

// Animation variants
const itemVariants: Variants = {
    initial: { rotateX: 0, opacity: 1 },
    hover: { rotateX: -90, opacity: 0 },
}

const backVariants: Variants = {
    initial: { rotateX: 90, opacity: 0 },
    hover: { rotateX: 0, opacity: 1 },
}

const glowVariants: Variants = {
    initial: { opacity: 0, scale: 0.8 },
    hover: {
        opacity: 1,
        scale: 2,
        transition: {
            opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
            scale: { duration: 0.5, type: "spring", stiffness: 300, damping: 25 },
        },
    },
}

const sharedTransition = {
    type: "spring" as const,
    stiffness: 100,
    damping: 20,
    duration: 0.5,
}

export function Header(): React.JSX.Element {
    const pathname = usePathname()

    return (
        <header className="fixed top-0 left-0 w-full z-50">
            <div className="mx-auto max-w-7xl px-4 py-3">
                <motion.nav
                    className="w-full mx-auto px-3 py-2.5 rounded-2xl 
          bg-black/20 backdrop-blur-2xl 
          border border-white/10 
          shadow-2xl shadow-black/20 relative"
                    initial="initial"
                    whileHover="hover"
                >
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="relative">
                                <div className="h-9 w-9 rounded-lg bg-linear-to-br from-primary to-cyan-400 flex items-center justify-center font-bold text-primary-foreground text-sm">
                                    BZ
                                </div>
                                <div className="absolute inset-0 rounded-lg bg-linear-to-br from-primary to-cyan-400 opacity-50 blur-md group-hover:opacity-75 transition-opacity" />
                            </div>
                            <span className="hidden sm:block font-bold text-lg tracking-tight">
                                BasisZero
                            </span>
                        </Link>

                        {/* Navigation Items */}
                        <ul className="flex items-center gap-1 md:gap-2 relative z-10">
                            {menuItems.map((item: NavMenuItem) => {
                                const isActive = pathname === item.href
                                return (
                                    <motion.li key={item.label} className="relative">
                                        <motion.div
                                            className="block rounded-xl overflow-visible group relative"
                                            style={{ perspective: "600px" }}
                                            whileHover="hover"
                                            initial="initial"
                                        >
                                            {/* Per-item glow */}
                                            <motion.div
                                                className="absolute inset-0 z-0 pointer-events-none rounded-xl"
                                                variants={glowVariants}
                                                style={{
                                                    background: item.gradient,
                                                    opacity: 0,
                                                }}
                                            />
                                            {/* Front-facing */}
                                            <motion.div
                                                className={`flex items-center justify-center gap-2 
                        px-3 py-2 md:px-4 md:py-2 relative z-10 
                        bg-transparent 
                        ${isActive ? 'text-primary' : 'text-muted-foreground'}
                        group-hover:text-foreground 
                        transition-colors rounded-xl text-sm cursor-pointer`}
                                                variants={itemVariants}
                                                transition={sharedTransition}
                                                style={{
                                                    transformStyle: "preserve-3d",
                                                    transformOrigin: "center bottom"
                                                }}
                                            >
                                                <Link href={item.href} className="flex items-center gap-2">
                                                    <span className={`transition-colors duration-300 ${isActive ? 'text-primary' : item.iconColor}`}>
                                                        {item.icon}
                                                    </span>
                                                    <span className="hidden md:inline font-medium">{item.label}</span>
                                                </Link>
                                            </motion.div>
                                            {/* Back-facing (appears on flip) */}
                                            <motion.div
                                                className={`flex items-center justify-center gap-2 
                        px-3 py-2 md:px-4 md:py-2 absolute inset-0 z-10 
                        bg-transparent text-foreground
                        transition-colors rounded-xl text-sm cursor-pointer`}
                                                variants={backVariants}
                                                transition={sharedTransition}
                                                style={{
                                                    transformStyle: "preserve-3d",
                                                    transformOrigin: "center top",
                                                    transform: "rotateX(90deg)"
                                                }}
                                            >
                                                <Link href={item.href} className="flex items-center gap-2">
                                                    <span className={`transition-colors duration-300 ${item.iconColor.replace('group-hover:', '')}`}>
                                                        {item.icon}
                                                    </span>
                                                    <span className="hidden md:inline font-medium">{item.label}</span>
                                                </Link>
                                            </motion.div>
                                        </motion.div>
                                    </motion.li>
                                )
                            })}
                        </ul>

                        {/* Connect Wallet Button */}
                        <motion.button
                            className="group relative flex items-center gap-2 px-4 py-2 rounded-xl
              bg-primary/10 border border-primary/30
              text-primary font-medium text-sm
              overflow-hidden cursor-pointer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Animated gradient background on hover */}
                            <motion.div
                                className="absolute inset-0 bg-linear-to-r from-primary to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                            <Wallet className="h-4 w-4 relative z-10 group-hover:text-primary-foreground transition-colors" />
                            <span className="hidden sm:inline relative z-10 group-hover:text-primary-foreground transition-colors">
                                Connect Wallet
                            </span>
                        </motion.button>
                    </div>
                </motion.nav>
            </div>
        </header>
    )
}

export default Header
