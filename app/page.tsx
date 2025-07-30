"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Wallet,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Send,
  RefreshCw,
  History,
  Network,
  Coins,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MartianWallet {
  connect: () => Promise<{ address: string; publicKey: string }>
  disconnect: () => Promise<void>
  isConnected: () => Promise<boolean>
  account: () => Promise<{ address: string; publicKey: string }>
  network: () => Promise<{ name: string; chainId: string; url: string }>
  changeNetwork: (network: { name: string; chainId: string; url: string }) => Promise<void>
  signAndSubmitTransaction: (transaction: any) => Promise<{ hash: string }>
}

interface AccountBalance {
  coin: {
    value: string
  }
}

interface Transaction {
  version: string
  hash: string
  state_change_hash: string
  event_root_hash: string
  gas_used: string
  success: boolean
  vm_status: string
  accumulator_root_hash: string
  timestamp: string
  type: string
  payload?: {
    function: string
    arguments: string[]
    type: string
  }
}

interface NetworkConfig {
  name: string
  chainId: string
  url: string
}

declare global {
  interface Window {
    martian?: MartianWallet
  }
}

const NETWORKS: NetworkConfig[] = [
  {
    name: "Mainnet",
    chainId: "1",
    url: "https://fullnode.mainnet.aptoslabs.com/v1",
  },
  {
    name: "Testnet",
    chainId: "2",
    url: "https://fullnode.testnet.aptoslabs.com/v1",
  },
  {
    name: "Devnet",
    chainId: "3",
    url: "https://fullnode.devnet.aptoslabs.com/v1",
  },
]

export default function MartianWalletConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [publicKey, setPublicKey] = useState<string>("")
  const [network, setNetwork] = useState<NetworkConfig | null>(null)
  const [balance, setBalance] = useState<string>("0")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [isWalletInstalled, setIsWalletInstalled] = useState(false)

  // Transaction form state
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Loading states
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    checkWalletInstallation()
    checkConnection()
  }, [])

  useEffect(() => {
    if (isConnected && walletAddress && network) {
      fetchBalance()
      fetchTransactions()
    }
  }, [isConnected, walletAddress, network])

  const checkWalletInstallation = () => {
    if (typeof window !== "undefined" && window.martian) {
      setIsWalletInstalled(true)
    } else {
      setIsWalletInstalled(false)
    }
  }

  const checkConnection = async () => {
    if (window.martian) {
      try {
        const connected = await window.martian.isConnected()
        if (connected) {
          const account = await window.martian.account()
          const networkInfo = await window.martian.network()
          setIsConnected(true)
          setWalletAddress(account.address)
          setPublicKey(account.publicKey)
          setNetwork(networkInfo)
        }
      } catch (err) {
        console.error("Error checking connection:", err)
      }
    }
  }

  const connectWallet = async () => {
    if (!window.martian) {
      setError("Martian wallet is not installed")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const account = await window.martian.connect()
      const networkInfo = await window.martian.network()

      setIsConnected(true)
      setWalletAddress(account.address)
      setPublicKey(account.publicKey)
      setNetwork(networkInfo)

      toast({
        title: "Wallet Connected",
        description: "Successfully connected to Martian wallet",
      })
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet")
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to connect wallet",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectWallet = async () => {
    if (!window.martian) return

    setIsLoading(true)
    try {
      await window.martian.disconnect()
      setIsConnected(false)
      setWalletAddress("")
      setPublicKey("")
      setNetwork(null)
      setBalance("0")
      setTransactions([])
      setError("")

      toast({
        title: "Wallet Disconnected",
        description: "Successfully disconnected from Martian wallet",
      })
    } catch (err: any) {
      setError(err.message || "Failed to disconnect wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBalance = async () => {
    if (!walletAddress || !network) return

    setIsLoadingBalance(true)
    try {
      const response = await fetch(
        `${network.url}/accounts/${walletAddress}/resource/0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>`,
      )

      if (response.ok) {
        const data: AccountBalance = await response.json()
        const aptBalance = (Number.parseInt(data.coin.value) / 100000000).toFixed(8) // Convert from octas to APT
        setBalance(aptBalance)
      } else {
        setBalance("0")
      }
    } catch (err) {
      console.error("Error fetching balance:", err)
      setBalance("0")
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const fetchTransactions = async () => {
    if (!walletAddress || !network) return

    setIsLoadingTransactions(true)
    try {
      const response = await fetch(`${network.url}/accounts/${walletAddress}/transactions?limit=20`)

      if (response.ok) {
        const data: Transaction[] = await response.json()
        setTransactions(data)
      }
    } catch (err) {
      console.error("Error fetching transactions:", err)
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  const switchNetwork = async (selectedNetwork: NetworkConfig) => {
    if (!window.martian) return

    setIsSwitchingNetwork(true)
    try {
      await window.martian.changeNetwork(selectedNetwork)
      setNetwork(selectedNetwork)

      toast({
        title: "Network Switched",
        description: `Switched to ${selectedNetwork.name}`,
      })

      // Refresh balance and transactions for new network
      setTimeout(() => {
        fetchBalance()
        fetchTransactions()
      }, 1000)
    } catch (err: any) {
      toast({
        title: "Network Switch Failed",
        description: err.message || "Failed to switch network",
        variant: "destructive",
      })
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  const sendTransaction = async () => {
    if (!window.martian || !recipient || !amount) return

    setIsSending(true)
    try {
      const transaction = {
        type: "entry_function_payload",
        function: "0x1::coin::transfer",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [recipient, (Number.parseFloat(amount) * 100000000).toString()], // Convert APT to octas
      }

      const result = await window.martian.signAndSubmitTransaction(transaction)

      toast({
        title: "Transaction Sent",
        description: `Transaction hash: ${result.hash.slice(0, 10)}...`,
      })

      setRecipient("")
      setAmount("")

      // Refresh balance and transactions
      setTimeout(() => {
        fetchBalance()
        fetchTransactions()
      }, 2000)
    } catch (err: any) {
      toast({
        title: "Transaction Failed",
        description: err.message || "Failed to send transaction",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
  }

  const truncateAddress = (address: string) => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(Number.parseInt(timestamp) / 1000).toLocaleString()
  }

  if (!isWalletInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-sky-200 shadow-lg shadow-sky-100">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-sky-900">Martian Wallet Not Found</CardTitle>
              <CardDescription className="text-sky-700">
                Please install the Martian wallet extension to continue
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                Martian wallet extension is required to use this application
              </AlertDescription>
            </Alert>
            <Button
              className="w-full bg-sky-600 hover:bg-sky-700 text-white"
              onClick={() => window.open("https://martianwallet.xyz/", "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Install Martian Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-sky-200 shadow-lg shadow-sky-100">
          <CardHeader className="text-center bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-lg space-y-4">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Martian Aptos Wallet</CardTitle>
              <CardDescription className="text-sky-100">
                Connect your Martian wallet to interact with the Aptos blockchain
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 bg-white p-6">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            {!isConnected ? (
              <div className="space-y-4">
                <Button
                  onClick={connectWallet}
                  disabled={isLoading}
                  className="w-full h-12 text-lg bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Wallet className="w-5 h-5 mr-2" />
                      Connect Martian Wallet
                    </div>
                  )}
                </Button>

                <div className="text-center text-sm text-sky-600">
                  Make sure your Martian wallet extension is unlocked
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center space-x-2 text-sky-700 bg-sky-50 p-3 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Wallet Connected</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-sky-700">Address</label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 p-3 bg-sky-50 border border-sky-200 rounded text-sm font-mono text-sky-800 min-h-[44px] flex items-center">
                        {truncateAddress(walletAddress)}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sky-300 text-sky-700 hover:bg-sky-50 bg-transparent h-[44px] w-[44px] p-0 flex items-center justify-center"
                        onClick={() => copyToClipboard(walletAddress, "Address")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-sky-700">Balance</label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 p-3 bg-sky-50 border border-sky-200 rounded text-sm font-mono text-sky-800 min-h-[44px] flex items-center">
                        <Coins className="w-4 h-4 mr-2 text-sky-600 flex-shrink-0" />
                        <span className="flex-1">
                          {isLoadingBalance ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600"></div>
                            </div>
                          ) : (
                            `${balance} APT`
                          )}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sky-300 text-sky-700 hover:bg-sky-50 bg-transparent h-[44px] w-[44px] p-0 flex items-center justify-center"
                        onClick={fetchBalance}
                        disabled={isLoadingBalance}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-sky-700">Network</label>
                    <Select
                      value={network?.name || ""}
                      onValueChange={(value) => {
                        const selectedNetwork = NETWORKS.find((n) => n.name === value)
                        if (selectedNetwork) switchNetwork(selectedNetwork)
                      }}
                      disabled={isSwitchingNetwork}
                    >
                      <SelectTrigger className="border-sky-200 bg-sky-50 text-sky-800 h-[44px]">
                        <SelectValue>
                          {isSwitchingNetwork ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600 mr-2"></div>
                              Switching...
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Network className="w-4 h-4 mr-2 text-sky-600 flex-shrink-0" />
                              {network?.name}
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORKS.map((net) => (
                          <SelectItem key={net.chainId} value={net.name}>
                            {net.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={disconnectWallet}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full border-sky-300 text-sky-700 hover:bg-sky-50 bg-transparent h-12"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600 mr-2"></div>
                      Disconnecting...
                    </div>
                  ) : (
                    "Disconnect Wallet"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isConnected && (
          <Tabs defaultValue="send" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-sky-100 border-sky-200 h-12">
              <TabsTrigger
                value="send"
                className="flex items-center justify-center space-x-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white h-10"
              >
                <Send className="w-4 h-4" />
                <span>Send Transaction</span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex items-center justify-center space-x-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white h-10"
              >
                <History className="w-4 h-4" />
                <span>Transaction History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="mt-6">
              <Card className="border-sky-200 shadow-lg shadow-sky-100">
                <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-lg space-y-2">
                  <CardTitle>Send APT</CardTitle>
                  <CardDescription className="text-sky-100">Send APT tokens to another address</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 bg-white p-6">
                  <div className="space-y-2">
                    <Label htmlFor="recipient" className="text-sky-700 text-sm font-medium">
                      Recipient Address
                    </Label>
                    <Input
                      id="recipient"
                      placeholder="0x..."
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="border-sky-200 focus:border-sky-500 focus:ring-sky-500 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sky-700 text-sm font-medium">
                      Amount (APT)
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.00000001"
                      placeholder="0.0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="border-sky-200 focus:border-sky-500 focus:ring-sky-500 h-12"
                    />
                  </div>
                  <Button
                    onClick={sendTransaction}
                    disabled={isSending || !recipient || !amount}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white h-12"
                  >
                    {isSending ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Send className="w-4 h-4 mr-2" />
                        Send Transaction
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card className="border-sky-200 shadow-lg shadow-sky-100">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-lg p-6">
                  <div className="space-y-2">
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription className="text-sky-100">Recent transactions from your wallet</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 bg-transparent h-10 w-10 p-0 flex items-center justify-center"
                    onClick={fetchTransactions}
                    disabled={isLoadingTransactions}
                  >
                    {isLoadingTransactions ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="bg-white p-6">
                  <ScrollArea className="h-96">
                    {transactions.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-sky-600 py-8">
                        No transactions found
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {transactions.map((tx) => (
                          <div key={tx.hash} className="border border-sky-200 rounded-lg p-4 bg-sky-50/50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <Badge
                                  variant={tx.success ? "default" : "destructive"}
                                  className={tx.success ? "bg-sky-600 text-white" : ""}
                                >
                                  {tx.success ? "Success" : "Failed"}
                                </Badge>
                                <span className="text-sm text-sky-600">{tx.type}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-sky-600 hover:bg-sky-100 h-8 w-8 p-0 flex items-center justify-center"
                                onClick={() => copyToClipboard(tx.hash, "Transaction Hash")}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start">
                                <span className="font-medium text-sky-700 w-20 flex-shrink-0">Hash:</span>
                                <code className="text-xs text-sky-600 break-all">{truncateAddress(tx.hash)}</code>
                              </div>
                              <div className="flex items-center">
                                <span className="font-medium text-sky-700 w-20 flex-shrink-0">Gas Used:</span>
                                <span className="text-sky-600">{tx.gas_used}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="font-medium text-sky-700 w-20 flex-shrink-0">Time:</span>
                                <span className="text-sky-600">{formatTimestamp(tx.timestamp)}</span>
                              </div>
                              {tx.payload && (
                                <div className="flex items-start">
                                  <span className="font-medium text-sky-700 w-20 flex-shrink-0">Function:</span>
                                  <code className="text-xs text-sky-600 break-all">{tx.payload.function}</code>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-sky-600">Powered by Martian Wallet • Aptos Blockchain</p>
        </div>
      </div>
    </div>
  )
}
