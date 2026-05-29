import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiService } from '@/services/api'
import type { RequestLogEntry } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Search, Trash2 } from 'lucide-react'

type StatusFilter = 'all' | 'success' | 'error'

const REFRESH_INTERVAL_MS = 5000

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return '-'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function tryPrettyJson(raw?: string): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function RequestLogList() {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [logs, setLogs] = useState<RequestLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RequestLogEntry | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filter: Record<string, unknown> = { limit: 200 }
      if (statusFilter !== 'all') filter.status = statusFilter
      const data = await ApiService.requestLogs.get(filter)
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[RequestLogList] failed to load logs', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void loadLogs()
    const id = window.setInterval(() => {
      void loadLogs()
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [loadLogs])

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.trim().toLowerCase()
    return logs.filter((log) => {
      const haystack = [
        log.model,
        log.actualModel,
        log.providerName,
        log.accountName,
        log.url,
        log.userInput,
        log.errorMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [logs, search])

  const handleClear = useCallback(async () => {
    if (!window.confirm(t('logs.clearConfirmDesc'))) return
    try {
      await ApiService.requestLogs.clear()
      setLogs([])
      toast({
        title: t('logs.clearSuccess'),
        description: t('logs.allLogsCleared'),
      })
    } catch (err) {
      console.error('[RequestLogList] clear failed', err)
      toast({
        title: t('logs.clearFailed'),
        description: t('logs.cannotClearLogs'),
        variant: 'destructive',
      })
    }
  }, [t, toast])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] sm:min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('logs.search')}
            className="pl-8"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('logs.all')}</SelectItem>
            <SelectItem value="success">{t('common.success', 'Success')}</SelectItem>
            <SelectItem value="error">{t('logs.error')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadLogs()}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Refresh')}
        </Button>

        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('logs.clearLogs')}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">{t('logs.time')}</TableHead>
              <TableHead className="w-[100px]">{t('logs.status')}</TableHead>
              <TableHead>{t('logs.model')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('logs.provider')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('logs.account')}</TableHead>
              <TableHead className="w-[100px] text-right">{t('logs.latency')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  {t('logs.noRequestLogs')}
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(log)}
                >
                  <TableCell className="font-mono text-xs">
                    {formatTimestamp(log.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.status === 'success' ? 'secondary' : 'destructive'}
                    >
                      {log.statusCode || log.responseStatus || log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.model}
                    {log.actualModel && log.actualModel !== log.model ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        → {log.actualModel}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{log.providerName || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{log.accountName || '-'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatLatency(log.latency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RequestLogDetailDialog
        log={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </div>
  )
}

interface DetailProps {
  log: RequestLogEntry | null
  onOpenChange: (open: boolean) => void
}

function RequestLogDetailDialog({ log, onOpenChange }: DetailProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={Boolean(log)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('logs.logDetails')}</DialogTitle>
          <DialogDescription>{t('logs.viewCompleteLogInfo')}</DialogDescription>
        </DialogHeader>

        {log ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList>
              <TabsTrigger value="info">{t('logs.tabInfo')}</TabsTrigger>
              <TabsTrigger value="userInput">{t('logs.tabUserInput')}</TabsTrigger>
              <TabsTrigger value="request">{t('logs.tabRequest')}</TabsTrigger>
              <TabsTrigger value="response">{t('logs.tabResponse')}</TabsTrigger>
              <TabsTrigger value="error">{t('logs.tabError')}</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <ScrollArea className="h-[55vh]">
                <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t('logs.time')}</dt>
                  <dd>{formatTimestamp(log.timestamp)}</dd>
                  <dt className="text-muted-foreground">{t('logs.status')}</dt>
                  <dd>{log.status}</dd>
                  <dt className="text-muted-foreground">{t('logs.method')}</dt>
                  <dd>{log.method}</dd>
                  <dt className="text-muted-foreground">{t('logs.url')}</dt>
                  <dd className="break-all">{log.url}</dd>
                  <dt className="text-muted-foreground">{t('logs.model')}</dt>
                  <dd>{log.model}</dd>
                  {log.actualModel ? (
                    <>
                      <dt className="text-muted-foreground">Actual Model</dt>
                      <dd>{log.actualModel}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">{t('logs.provider')}</dt>
                  <dd>{log.providerName || log.providerId || '-'}</dd>
                  <dt className="text-muted-foreground">{t('logs.account')}</dt>
                  <dd>{log.accountName || log.accountId || '-'}</dd>
                  <dt className="text-muted-foreground">{t('logs.latency')}</dt>
                  <dd>{formatLatency(log.latency)}</dd>
                  <dt className="text-muted-foreground">{t('logs.stream')}</dt>
                  <dd>{log.isStream ? 'Yes' : 'No'}</dd>
                  <dt className="text-muted-foreground">{t('logs.responseStatus')}</dt>
                  <dd>{log.responseStatus}</dd>
                  {typeof log.webSearch === 'boolean' ? (
                    <>
                      <dt className="text-muted-foreground">{t('logs.webSearch')}</dt>
                      <dd>{log.webSearch ? 'Yes' : 'No'}</dd>
                    </>
                  ) : null}
                  {log.reasoningEffort ? (
                    <>
                      <dt className="text-muted-foreground">{t('logs.reasoningEffort')}</dt>
                      <dd>{log.reasoningEffort}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">{t('logs.requestId')}</dt>
                  <dd className="break-all font-mono text-xs">{log.id}</dd>
                </dl>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="userInput">
              <ScrollArea className="h-[55vh]">
                <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                  {log.userInput || t('logs.noUserInput')}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="request">
              <ScrollArea className="h-[55vh]">
                <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                  {tryPrettyJson(log.requestBody) || t('logs.noRequestData')}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="response">
              <ScrollArea className="h-[55vh]">
                <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                  {tryPrettyJson(log.responseBody) ||
                    log.responsePreview ||
                    t('logs.noRequestData')}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="error">
              <ScrollArea className="h-[55vh] space-y-3">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t('logs.errorMessage')}
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                    {log.errorMessage || t('logs.noError')}
                  </pre>
                </div>
                {log.errorStack ? (
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      {t('logs.stackTrace')}
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                      {log.errorStack}
                    </pre>
                  </div>
                ) : null}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
