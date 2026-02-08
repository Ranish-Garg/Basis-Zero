"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Loader2, Plus, TrendingUp, Users, Wallet, DollarSign } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Market {
    marketId: string
    title: string
    description: string | null
    category: string
    status: string
    yesReserves: string
    noReserves: string
    prices: {
        yesPrice: number
        noPrice: number
        yesProbability: number
        noProbability: number
    }
    expiresAt: string
    createdAt: string
}

interface Session {
    session_id: string
    user_address: string
    status: string
    initial_collateral: string
    current_balance: string
    nonce: number
    created_at: string
}

interface Position {
    marketId: string
    outcome: string
    shares: string
    averageEntryPrice: number
}

export default function AMMTestPage() {
    const [markets, setMarkets] = useState<Market[]>([])
    const [sessions, setSessions] = useState<Session[]>([])
    const [positions, setPositions] = useState<Position[]>([])
    const [selectedSessionId, setSelectedSessionId] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Form states
    const [newMarket, setNewMarket] = useState({
        marketId: "",
        title: "",
        description: "",
        category: "crypto",
        expiresAt: "",
        initialLiquidity: "1000000000" // 1000 USDC (6 decimals)
    })

    const [newSession, setNewSession] = useState({
        sessionId: "",
        userAddress: "",
        initialCollateral: "5000000000" // 5000 USDC
    })

    const [betForm, setBetForm] = useState({
        marketId: "",
        sessionId: "",
        amount: "100000000", // 100 USDC
        outcome: "0" // 0 = YES, 1 = NO
    })

    const [sellForm, setSellForm] = useState({
        marketId: "",
        sessionId: "",
        amount: "50000000", // 50 shares
        outcome: "0"
    })

    const [availablePositions, setAvailablePositions] = useState<{
        yesShares: string;
        noShares: string;
    } | null>(null)

    // Fetch position details for selected market/session
    const fetchPositionDetails = async (marketId: string, sessionId: string) => {
        if (!marketId || !sessionId) {
            setAvailablePositions(null)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/api/amm/position/${marketId}/${sessionId}`)
            if (response.ok) {
                const data = await response.json()
                setAvailablePositions(data.position)
            } else {
                setAvailablePositions(null)
            }
        } catch (err) {
            console.error('Failed to fetch position:', err)
            setAvailablePositions(null)
        }
    }

    // Fetch all data
    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [marketsRes, sessionsRes] = await Promise.all([
                fetch(`${API_BASE}/api/amm/markets`),
                fetch(`${API_BASE}/api/sessions`)
            ])

            if (marketsRes.ok) {
                const data = await marketsRes.json()
                setMarkets(data.markets || [])
            }

            if (sessionsRes.ok) {
                const data = await sessionsRes.json()
                setSessions(data.sessions || [])
            }

            // Fetch positions if a session is selected
            if (selectedSessionId) {
                const posRes = await fetch(`${API_BASE}/api/amm/positions/${selectedSessionId}`)
                if (posRes.ok) {
                    const data = await posRes.json()
                    setPositions(data.positions || [])
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [selectedSessionId])

    // Fetch position details when sell form changes
    useEffect(() => {
        fetchPositionDetails(sellForm.marketId, sellForm.sessionId)
    }, [sellForm.marketId, sellForm.sessionId])

    // Create Market
    const handleCreateMarket = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch(`${API_BASE}/api/amm/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: newMarket.marketId || `market-${Date.now()}`,
                    title: newMarket.title,
                    description: newMarket.description,
                    category: newMarket.category,
                    expiresAt: newMarket.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    initialLiquidity: newMarket.initialLiquidity
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create market')
            }

            setSuccess(`Market created: ${data.market.marketId}`)
            setNewMarket({
                marketId: "",
                title: "",
                description: "",
                category: "crypto",
                expiresAt: "",
                initialLiquidity: "1000000000"
            })
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create market')
        } finally {
            setLoading(false)
        }
    }

    // Create Session
    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch(`${API_BASE}/api/sessions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: newSession.sessionId || `session-${Date.now()}`,
                    userAddress: newSession.userAddress || `0x${Math.random().toString(16).slice(2, 42)}`,
                    initialCollateral: newSession.initialCollateral,
                    signature: 'test-signature'
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create session')
            }

            setSuccess(`Session created: ${data.session.session_id}`)
            setNewSession({
                sessionId: "",
                userAddress: "",
                initialCollateral: "5000000000"
            })
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create session')
        } finally {
            setLoading(false)
        }
    }

    // Place Bet
    const handlePlaceBet = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch(`${API_BASE}/api/amm/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: betForm.marketId,
                    userId: betForm.sessionId,
                    amount: betForm.amount,
                    outcome: parseInt(betForm.outcome)
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to place bet')
            }

            setSuccess(`Bet placed! Shares: ${(parseFloat(data.shares) / 1e6).toFixed(2)}, Price: $${data.effectivePrice.toFixed(4)}`)
            setBetForm({
                marketId: "",
                sessionId: "",
                amount: "100000000",
                outcome: "0"
            })
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to place bet')
        } finally {
            setLoading(false)
        }
    }

    // Sell Position
    const handleSellPosition = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch(`${API_BASE}/api/amm/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: sellForm.marketId,
                    userId: sellForm.sessionId,
                    amount: sellForm.amount,
                    outcome: parseInt(sellForm.outcome)
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to sell position')
            }

            setSuccess(`Position sold! USDC received: ${(parseFloat(data.usdcOut) / 1e6).toFixed(2)}`)
            setSellForm({
                marketId: "",
                sessionId: "",
                amount: "50000000",
                outcome: "0"
            })
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sell position')
        } finally {
            setLoading(false)
        }
    }

    // End Session
    const handleEndSession = async (sessionId: string) => {
        if (!confirm(`Are you sure you want to end session ${sessionId}? This will set its status to CLOSED.`)) {
            return
        }

        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to close session')
            }

            setSuccess(`Session ${sessionId} has been closed`)
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to close session')
        } finally {
            setLoading(false)
        }
    }

    const formatUSDC = (amount: string) => {
        return (parseFloat(amount) / 1e6).toFixed(2)
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-background">
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">AMM Test Dashboard</h1>
                    <p className="text-muted-foreground">
                        Test AMM functionality with database - No blockchain required
                    </p>
                </div>

                {/* Alerts */}
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="mb-4 border-green-500 bg-green-500/10">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertTitle className="text-green-500">Success</AlertTitle>
                        <AlertDescription className="text-green-500">{success}</AlertDescription>
                    </Alert>
                )}

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Markets
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{markets.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Sessions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{sessions.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                Total Positions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{positions.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Total Liquidity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                ${markets.reduce((sum, m) =>
                                    sum + (parseFloat(m.yesReserves) + parseFloat(m.noReserves)) / 1e6, 0
                                ).toFixed(0)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Tabs */}
                <Tabs defaultValue="markets" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="markets">Markets</TabsTrigger>
                        <TabsTrigger value="sessions">Sessions</TabsTrigger>
                        <TabsTrigger value="trade">Trade</TabsTrigger>
                        <TabsTrigger value="create">Create</TabsTrigger>
                    </TabsList>

                    {/* Markets Tab */}
                    <TabsContent value="markets" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Markets</CardTitle>
                                <CardDescription>All prediction markets in the database</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={fetchData} disabled={loading} className="mb-4">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Refresh
                                </Button>

                                <div className="space-y-3">
                                    {markets.map((market) => (
                                        <Card key={market.marketId} className="border-2">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base">{market.title}</CardTitle>
                                                        <CardDescription className="text-xs mt-1">
                                                            {market.marketId}
                                                        </CardDescription>
                                                    </div>
                                                    <Badge variant="outline">{market.status}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">YES Price</p>
                                                        <p className="text-lg font-bold text-green-500">
                                                            ${market.prices.yesPrice.toFixed(3)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {market.prices.yesProbability}% probability
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">NO Price</p>
                                                        <p className="text-lg font-bold text-red-500">
                                                            ${market.prices.noPrice.toFixed(3)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {market.prices.noProbability}% probability
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">YES Reserves</p>
                                                        <p className="font-mono text-sm">{formatUSDC(market.yesReserves)} USDC</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">NO Reserves</p>
                                                        <p className="font-mono text-sm">{formatUSDC(market.noReserves)} USDC</p>
                                                    </div>
                                                </div>

                                                <div className="text-xs text-muted-foreground">
                                                    Category: <Badge variant="secondary" className="ml-1">{market.category}</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    {markets.length === 0 && !loading && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No markets found. Create one in the "Create" tab.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Sessions Tab */}
                    <TabsContent value="sessions" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Sessions</CardTitle>
                                <CardDescription>All trading sessions with balances</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {sessions.map((session) => (
                                        <Card
                                            key={session.session_id}
                                            className={`border-2 cursor-pointer transition-all ${selectedSessionId === session.session_id
                                                    ? 'border-primary'
                                                    : 'hover:border-primary/50'
                                                }`}
                                            onClick={() => setSelectedSessionId(session.session_id)}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base font-mono">
                                                            {session.session_id}
                                                        </CardTitle>
                                                        <CardDescription className="text-xs mt-1">
                                                            User: {session.user_address.slice(0, 10)}...
                                                        </CardDescription>
                                                    </div>
                                                    <Badge variant={session.status === 'OPEN' ? 'default' : 'secondary'}>
                                                        {session.status}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Initial</p>
                                                        <p className="font-mono text-sm font-semibold">
                                                            ${formatUSDC(session.initial_collateral)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Current Balance</p>
                                                        <p className="font-mono text-sm font-semibold text-green-500">
                                                            ${formatUSDC(session.current_balance)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Nonce</p>
                                                        <p className="font-mono text-sm">{session.nonce}</p>
                                                    </div>
                                                </div>
                                                {session.status === 'OPEN' && (
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEndSession(session.session_id)
                                                        }}
                                                        variant="destructive"
                                                        size="sm"
                                                        disabled={loading}
                                                        className="mt-4 w-full"
                                                    >
                                                        End Session
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}

                                    {sessions.length === 0 && !loading && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No sessions found. Create one in the "Create" tab.
                                        </div>
                                    )}
                                </div>

                                {/* Positions for Selected Session */}
                                {selectedSessionId && positions.length > 0 && (
                                    <Card className="mt-6">
                                        <CardHeader>
                                            <CardTitle className="text-base">
                                                Positions for {selectedSessionId}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {positions.map((pos, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                                                        <div className="flex-1">
                                                            <p className="font-mono text-sm">{pos.marketId}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Avg Entry: ${pos.averageEntryPrice.toFixed(4)}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <Badge variant={pos.outcome === 'YES' ? 'default' : 'destructive'}>
                                                                {pos.outcome}
                                                            </Badge>
                                                            <p className="font-mono text-sm mt-1">
                                                                {formatUSDC(pos.shares)} shares
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Trade Tab */}
                    <TabsContent value="trade" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Place Bet */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Place Bet</CardTitle>
                                    <CardDescription>Test betting functionality</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handlePlaceBet} className="space-y-4">
                                        <div>
                                            <Label>Market ID</Label>
                                            <Select value={betForm.marketId} onValueChange={(v) => setBetForm({ ...betForm, marketId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select market" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {markets.map(m => (
                                                        <SelectItem key={m.marketId} value={m.marketId}>
                                                            {m.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Session ID</Label>
                                            <Select value={betForm.sessionId} onValueChange={(v) => setBetForm({ ...betForm, sessionId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select session" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sessions.map(s => (
                                                        <SelectItem key={s.session_id} value={s.session_id}>
                                                            {s.session_id} (${formatUSDC(s.current_balance)})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Amount (USDC micro-units)</Label>
                                            <Input
                                                type="text"
                                                value={betForm.amount}
                                                onChange={(e) => setBetForm({ ...betForm, amount: e.target.value })}
                                                placeholder="100000000 = $100"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                = ${formatUSDC(betForm.amount)} USDC
                                            </p>
                                        </div>

                                        <div>
                                            <Label>Outcome</Label>
                                            <Select value={betForm.outcome} onValueChange={(v) => setBetForm({ ...betForm, outcome: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">YES</SelectItem>
                                                    <SelectItem value="1">NO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Button type="submit" disabled={loading} className="w-full">
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Place Bet
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            {/* Sell Position */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Sell Position</CardTitle>
                                    <CardDescription>Test selling functionality</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSellPosition} className="space-y-4">
                                        <div>
                                            <Label>Market ID</Label>
                                            <Select value={sellForm.marketId} onValueChange={(v) => setSellForm({ ...sellForm, marketId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select market" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {markets.map(m => (
                                                        <SelectItem key={m.marketId} value={m.marketId}>
                                                            {m.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Session ID</Label>
                                            <Select value={sellForm.sessionId} onValueChange={(v) => setSellForm({ ...sellForm, sessionId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select session" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sessions.map(s => (
                                                        <SelectItem key={s.session_id} value={s.session_id}>
                                                            {s.session_id}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Show Available Shares */}
                                        {availablePositions && (sellForm.marketId && sellForm.sessionId) && (
                                            <div className="p-3 bg-muted rounded-lg space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Available Shares:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="default" className="bg-green-500">YES</Badge>
                                                        <span className="font-mono text-sm font-semibold">
                                                            {formatUSDC(availablePositions.yesShares || '0')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="destructive">NO</Badge>
                                                        <span className="font-mono text-sm font-semibold">
                                                            {formatUSDC(availablePositions.noShares || '0')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(sellForm.marketId && sellForm.sessionId && !availablePositions) && (
                                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                                                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                                                    No positions found for this market/session combination
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <Label>Outcome</Label>
                                            <Select value={sellForm.outcome} onValueChange={(v) => setSellForm({ ...sellForm, outcome: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">
                                                        YES {availablePositions && `(${formatUSDC(availablePositions.yesShares || '0')} available)`}
                                                    </SelectItem>
                                                    <SelectItem value="1">
                                                        NO {availablePositions && `(${formatUSDC(availablePositions.noShares || '0')} available)`}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Shares Amount (micro-units)</Label>
                                            <Input
                                                type="text"
                                                value={sellForm.amount}
                                                onChange={(e) => setSellForm({ ...sellForm, amount: e.target.value })}
                                                placeholder="50000000 = 50 shares"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                = {formatUSDC(sellForm.amount)} shares
                                            </p>
                                        </div>

                                        <Button type="submit" disabled={loading} className="w-full">
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Sell Position
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Create Tab */}
                    <TabsContent value="create" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Create Market */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create Market</CardTitle>
                                    <CardDescription>Add a new prediction market</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateMarket} className="space-y-4">
                                        <div>
                                            <Label>Market ID (optional)</Label>
                                            <Input
                                                value={newMarket.marketId}
                                                onChange={(e) => setNewMarket({ ...newMarket, marketId: e.target.value })}
                                                placeholder="Auto-generated if empty"
                                            />
                                        </div>

                                        <div>
                                            <Label>Title</Label>
                                            <Input
                                                value={newMarket.title}
                                                onChange={(e) => setNewMarket({ ...newMarket, title: e.target.value })}
                                                placeholder="Will Bitcoin reach $100k?"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <Label>Description</Label>
                                            <Textarea
                                                value={newMarket.description}
                                                onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                                                placeholder="Market description..."
                                                rows={3}
                                            />
                                        </div>

                                        <div>
                                            <Label>Category</Label>
                                            <Select value={newMarket.category} onValueChange={(v) => setNewMarket({ ...newMarket, category: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="crypto">Crypto</SelectItem>
                                                    <SelectItem value="sports">Sports</SelectItem>
                                                    <SelectItem value="politics">Politics</SelectItem>
                                                    <SelectItem value="tech">Technology</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Expires At (optional)</Label>
                                            <Input
                                                type="datetime-local"
                                                value={newMarket.expiresAt}
                                                onChange={(e) => setNewMarket({ ...newMarket, expiresAt: e.target.value })}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Defaults to 7 days from now
                                            </p>
                                        </div>

                                        <div>
                                            <Label>Initial Liquidity (micro-units)</Label>
                                            <Input
                                                value={newMarket.initialLiquidity}
                                                onChange={(e) => setNewMarket({ ...newMarket, initialLiquidity: e.target.value })}
                                                placeholder="1000000000 = $1000"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                = ${formatUSDC(newMarket.initialLiquidity)} USDC
                                            </p>
                                        </div>

                                        <Button type="submit" disabled={loading} className="w-full">
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                            Create Market
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            {/* Create Session */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create Session</CardTitle>
                                    <CardDescription>Add a new trading session</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateSession} className="space-y-4">
                                        <div>
                                            <Label>Session ID (optional)</Label>
                                            <Input
                                                value={newSession.sessionId}
                                                onChange={(e) => setNewSession({ ...newSession, sessionId: e.target.value })}
                                                placeholder="Auto-generated if empty"
                                            />
                                        </div>

                                        <div>
                                            <Label>User Address (optional)</Label>
                                            <Input
                                                value={newSession.userAddress}
                                                onChange={(e) => setNewSession({ ...newSession, userAddress: e.target.value })}
                                                placeholder="0x... (auto-generated if empty)"
                                            />
                                        </div>

                                        <div>
                                            <Label>Initial Collateral (micro-units)</Label>
                                            <Input
                                                value={newSession.initialCollateral}
                                                onChange={(e) => setNewSession({ ...newSession, initialCollateral: e.target.value })}
                                                placeholder="5000000000 = $5000"
                                                required
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                = ${formatUSDC(newSession.initialCollateral)} USDC
                                            </p>
                                        </div>

                                        <Button type="submit" disabled={loading} className="w-full">
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                            Create Session
                                        </Button>
                                    </form>

                                    <div className="mt-6 p-4 bg-muted rounded-lg">
                                        <h4 className="font-semibold text-sm mb-2">Quick Tips:</h4>
                                        <ul className="text-xs space-y-1 text-muted-foreground">
                                            <li>• USDC uses 6 decimals: 1000000 = $1</li>
                                            <li>• Session balance is used for betting</li>
                                            <li>• Positions are tied to sessions</li>
                                            <li>• All IDs are auto-generated if not provided</li>
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
