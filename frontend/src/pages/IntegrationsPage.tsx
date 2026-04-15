import { useState, useEffect } from 'react'
import { Plug, Zap, Clock, Send, CheckCircle, XCircle, Loader, Activity, Database, Globe, CreditCard, Building2, Smartphone, Monitor, Landmark, Shield, FileText, Search, Copy, Download, FileCode } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, formatNumber } from '../utils/formatters'

const sourceIcons: Record<string, any> = {
  'cbs-finacle': Building2,
  'txn-switch': Zap,
  'card-mgmt': CreditCard,
  'swift-gw': Globe,
  'rtgs-neft': Landmark,
  'internet-banking': Monitor,
  'mobile-banking': Smartphone,
  'atm-switch': Database,
  'ofac-sdn': Shield,
  'un-sanctions': Shield,
  'pep-worldcheck': Search,
  'india-mha': Shield,
  'ckyc-registry': FileText,
  'fiu-ind': Send,
}

const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  connected: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Connected' },
  synced: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle, label: 'Synced' },
  disconnected: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Disconnected' },
  error: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Error' },
  running: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Loader, label: 'Running' },
  completed: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Failed' },
}

const typeLabels: Record<string, { label: string; color: string }> = {
  real_time: { label: 'Real-Time', color: 'bg-emerald-100 text-emerald-800' },
  batch: { label: 'Batch Sync', color: 'bg-blue-100 text-blue-800' },
  outbound: { label: 'Outbound', color: 'bg-purple-100 text-purple-800' },
}

const SAMPLE_STR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="goaml.xsd"
        schema_version="3.5">
  <Report_Indicators>
    <Report_Indicator>STR</Report_Indicator>
  </Report_Indicators>
  <rentity_id>AXISBANK001</rentity_id>
  <rentity_branch>MUM-MAIN</rentity_branch>
  <submission_code>E</submission_code>
  <report_code>STR</report_code>
  <entity_reference>STR-20260414-0042</entity_reference>
  <fiu_ref_number/>
  <submission_date>2026-04-14</submission_date>
  <currency_code_local>BTN</currency_code_local>
  <reporting_person>
    <gender>M</gender>
    <first_name>Arun</first_name>
    <last_name>Kumar</last_name>
    <title>Chief Compliance Officer</title>
    <occupation>Compliance</occupation>
    <phones>
      <phone>
        <tph_contact_type>W</tph_contact_type>
        <tph_number>02261234567</tph_number>
      </phone>
    </phones>
  </reporting_person>
  <location>
    <address_type>B</address_type>
    <address>Plot C-25, G Block, Bandra Kurla Complex</address>
    <city>Mumbai</city>
    <state_code>MH</state_code>
    <country_code>IN</country_code>
    <zip>400051</zip>
  </location>
  <transaction>
    <transactionnumber>TXN-20260410-8834</transactionnumber>
    <transaction_location>MUM-MAIN</transaction_location>
    <transaction_description>Multiple high-value cash deposits followed by immediate RTGS transfer to shell entity; structuring pattern detected by AML system</transaction_description>
    <date_transaction>2026-04-10</date_transaction>
    <teller>T-0051</teller>
    <authorized>A-0012</authorized>
    <amount_local>4850000</amount_local>
    <transaction_type>
      <transaction_type>CA</transaction_type>
    </transaction_type>
    <from_funds_code>C</from_funds_code>
    <from_account>
      <institution_name>Axis Bank Limited</institution_name>
      <swift>AXISINBB</swift>
      <account>
        <account_number>917020058834001</account_number>
        <account_name>Rajesh Mehta</account_name>
        <currency_code>BTN</currency_code>
        <account_type>4</account_type>
        <opened>2019-03-12</opened>
        <balance>127500</balance>
        <balance_date>2026-04-10</balance_date>
        <signatory>
          <gender>M</gender>
          <first_name>Rajesh</first_name>
          <last_name>Mehta</last_name>
          <dob>1978-06-15</dob>
          <id_number>XXXXX1234X</id_number>
          <nationality>IN</nationality>
          <addresses>
            <address>
              <address_type>R</address_type>
              <address>42, Worli Sea Face, Worli</address>
              <city>Mumbai</city>
              <country_code>IN</country_code>
              <zip>400018</zip>
            </address>
          </addresses>
        </signatory>
      </account>
    </from_account>
    <to_funds_code>T</to_funds_code>
    <to_account>
      <institution_name>HDFC Bank</institution_name>
      <swift>HDFCINBB</swift>
      <account>
        <account_number>50200012345678</account_number>
        <account_name>Global Trade Solutions Pvt Ltd</account_name>
        <currency_code>BTN</currency_code>
        <account_type>2</account_type>
      </account>
    </to_account>
  </transaction>
  <suspicious_activity>
    <activity_type>Structuring</activity_type>
    <activity_code>ST-01</activity_code>
    <description>Customer made 6 cash deposits of Nu. 4,85,000 each within 5 business days, just below the CTR threshold of Nu. 10,00,000. Funds immediately transferred out via RTGS to an entity with no prior relationship. Pattern consistent with layering stage of money laundering under PMLA 2002, Section 3.</description>
    <detection_date>2026-04-12</detection_date>
    <detection_method>Automated — AML Rule STR-001: Structuring</detection_method>
  </suspicious_activity>
</Report>`

const SAMPLE_CTR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="goaml.xsd"
        schema_version="3.5">
  <Report_Indicators>
    <Report_Indicator>CTR</Report_Indicator>
  </Report_Indicators>
  <rentity_id>AXISBANK001</rentity_id>
  <rentity_branch>DEL-CP</rentity_branch>
  <submission_code>E</submission_code>
  <report_code>CTR</report_code>
  <entity_reference>CTR-20260414-0158</entity_reference>
  <fiu_ref_number/>
  <submission_date>2026-04-14</submission_date>
  <currency_code_local>BTN</currency_code_local>
  <reporting_person>
    <gender>F</gender>
    <first_name>Priya</first_name>
    <last_name>Nair</last_name>
    <title>Branch Compliance Manager</title>
    <occupation>Compliance</occupation>
    <phones>
      <phone>
        <tph_contact_type>W</tph_contact_type>
        <tph_number>01145678901</tph_number>
      </phone>
    </phones>
  </reporting_person>
  <location>
    <address_type>B</address_type>
    <address>19, Barakhamba Road, Connaught Place</address>
    <city>New Delhi</city>
    <state_code>DL</state_code>
    <country_code>IN</country_code>
    <zip>110001</zip>
  </location>
  <transaction>
    <transactionnumber>TXN-20260409-5512</transactionnumber>
    <transaction_location>DEL-CP</transaction_location>
    <transaction_description>Large cash deposit exceeding Nu. 10,00,000 threshold — mandatory CTR filing under PMLA 2002 Section 12 and PML Rules 2005</transaction_description>
    <date_transaction>2026-04-09</date_transaction>
    <teller>T-0023</teller>
    <authorized>A-0008</authorized>
    <amount_local>15200000</amount_local>
    <transaction_type>
      <transaction_type>CD</transaction_type>
    </transaction_type>
    <from_funds_code>C</from_funds_code>
    <from_account>
      <institution_name>Axis Bank Limited</institution_name>
      <swift>AXISINBB</swift>
      <account>
        <account_number>917010034412009</account_number>
        <account_name>Hassan Trading Company</account_name>
        <currency_code>BTN</currency_code>
        <account_type>2</account_type>
        <opened>2021-07-01</opened>
        <balance>8342000</balance>
        <balance_date>2026-04-09</balance_date>
        <signatory>
          <gender>M</gender>
          <first_name>Mohammed</first_name>
          <last_name>Hassan</last_name>
          <dob>1965-11-22</dob>
          <id_number>XXXXX5678X</id_number>
          <nationality>IN</nationality>
          <addresses>
            <address>
              <address_type>B</address_type>
              <address>47-B, Chandni Chowk Market</address>
              <city>New Delhi</city>
              <country_code>IN</country_code>
              <zip>110006</zip>
            </address>
          </addresses>
        </signatory>
      </account>
    </from_account>
  </transaction>
  <threshold_indicator>
    <threshold_amount>1000000</threshold_amount>
    <threshold_currency>BTN</threshold_currency>
    <mandate>PMLA 2002 — Section 12 read with Rule 7 of PML (Maintenance of Records) Rules 2005</mandate>
    <filing_deadline_days>7</filing_deadline_days>
  </threshold_indicator>
</Report>`

export default function IntegrationsPage() {
  const [sources, setSources] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sources' | 'batches' | 'goaml'>('sources')
  const [filterType, setFilterType] = useState('')
  const [goamlSample, setGoamlSample] = useState<{ sar_xml: string; ctr_xml: string }>({
    sar_xml: SAMPLE_STR_XML,
    ctr_xml: SAMPLE_CTR_XML,
  })
  const [goamlSubTab, setGoamlSubTab] = useState<'str' | 'ctr'>('str')
  const [goamlLoading, setGoamlLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/integrations/sources'),
      api.get('/integrations/batches'),
      api.get('/integrations/stats'),
    ])
      .then(([srcRes, batchRes, statsRes]) => {
        setSources(srcRes.data)
        setBatches(batchRes.data)
        setStats(statsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'goaml') {
      api.get('/compliance/goaml-sample')
        .then(res => {
          if (res.data?.sar_xml) setGoamlSample(res.data)
        })
        .catch(() => { /* keep fallback sample XML */ })
    }
  }, [tab])

  const handleCopyXml = () => {
    const xml = goamlSubTab === 'str' ? goamlSample.sar_xml : goamlSample.ctr_xml
    navigator.clipboard.writeText(xml).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownloadXml = () => {
    const xml = goamlSubTab === 'str' ? goamlSample.sar_xml : goamlSample.ctr_xml
    const filename = goamlSubTab === 'str' ? 'sample-str-goaml.xml' : 'sample-ctr-goaml.xml'
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>

  const filteredSources = filterType ? sources.filter(s => s.type === filterType) : sources
  const realTimeSources = sources.filter(s => s.type === 'real_time')
  const batchSources = sources.filter(s => s.type === 'batch')
  const outboundSources = sources.filter(s => s.type === 'outbound')

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Real-Time Sources', value: stats.real_time_connected, icon: Zap, color: 'text-emerald-600', sub: 'Connected' },
            { label: 'Batch Sources', value: stats.batch_synced, icon: Clock, color: 'text-blue-600', sub: 'Synced' },
            { label: 'Records Today', value: formatNumber(stats.total_records_today), icon: Database, color: 'text-indigo-600', sub: 'Ingested' },
            { label: 'Avg Latency', value: `${stats.avg_latency_ms}ms`, icon: Activity, color: 'text-amber-600', sub: 'Real-time' },
            { label: 'System Uptime', value: `${stats.overall_uptime}%`, icon: CheckCircle, color: 'text-green-600', sub: 'Last 30 days' },
            { label: 'Failed Jobs (24h)', value: stats.failed_jobs_24h, icon: XCircle, color: stats.failed_jobs_24h > 0 ? 'text-red-600' : 'text-green-600', sub: 'Batch imports' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{s.label}</span>
                <s.icon size={16} className={s.color} />
              </div>
              <div className="text-xl font-bold text-slate-800">{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0">
        {[
          { key: 'sources', label: 'Data Sources', icon: Plug, count: sources.length },
          { key: 'batches', label: 'Batch Jobs', icon: Clock, count: batches.length },
          { key: 'goaml', label: 'FIU-IND GoAML', icon: FileCode, count: null },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            {t.count !== null && (
              <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sources Tab */}
      {tab === 'sources' && (
        <div className="space-y-4">
          {/* Filter pills */}
          <div className="flex gap-2">
            {[
              { key: '', label: `All Sources (${sources.length})` },
              { key: 'real_time', label: `Real-Time (${realTimeSources.length})` },
              { key: 'batch', label: `Batch (${batchSources.length})` },
              { key: 'outbound', label: `Outbound (${outboundSources.length})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Source Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredSources.map(src => {
              const Icon = sourceIcons[src.id] || Plug
              const st = statusConfig[src.status] || statusConfig.connected
              const StatusIcon = st.icon
              const typeInfo = typeLabels[src.type] || typeLabels.batch

              return (
                <div key={src.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Icon size={20} className="text-slate-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">{src.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                          <span className="text-xs text-slate-400">{src.protocol}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                      <StatusIcon size={12} />
                      {st.label}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">{src.description}</p>

                  <div className="text-xs text-slate-400 mb-3 font-mono bg-slate-50 px-2 py-1 rounded">{src.host}</div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {(src.data_types || []).map((dt: string) => (
                      <span key={dt} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">{dt.replace(/_/g, ' ')}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                    {src.type === 'real_time' && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Records Today</div>
                          <div className="text-sm font-semibold text-slate-700">{formatNumber(src.records_today)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Avg Latency</div>
                          <div className="text-sm font-semibold text-slate-700">{src.avg_latency_ms}ms</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Uptime</div>
                          <div className="text-sm font-semibold text-green-600">{src.uptime_percent}%</div>
                        </div>
                      </>
                    )}
                    {src.type === 'batch' && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Records Synced</div>
                          <div className="text-sm font-semibold text-slate-700">{formatNumber(src.records_synced)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Frequency</div>
                          <div className="text-sm font-medium text-slate-600">{src.sync_frequency}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Last Sync</div>
                          <div className="text-xs font-medium text-slate-600">{formatDateTime(src.last_sync)}</div>
                        </div>
                      </>
                    )}
                    {src.type === 'outbound' && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Filed MTD</div>
                          <div className="text-sm font-semibold text-slate-700">{src.reports_filed_mtd}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Frequency</div>
                          <div className="text-sm font-medium text-slate-600">{src.sync_frequency}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Last Filed</div>
                          <div className="text-xs font-medium text-slate-600">{formatDateTime(src.last_submission)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* GoAML Tab */}
      {tab === 'goaml' && (
        <div className="space-y-5">
          {/* Status banner */}
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <span className="text-sm font-semibold text-green-800">CONNECTED</span>
                <span className="text-sm text-green-700 ml-2">— GoAML portal endpoint configured. XML schema v3.5 validated.</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">v3.5</span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-lg font-bold text-slate-800">FIU-IND GoAML Portal Integration</h2>
            <p className="text-sm text-slate-500 mt-0.5">GoAML XML Schema v3.5 — Automated STR/CTR filing to Financial Intelligence Unit India</p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'STR Filed MTD', value: '12', color: 'text-blue-600', icon: Send },
              { label: 'CTR Filed MTD', value: '38', color: 'text-indigo-600', icon: FileText },
              { label: 'Last Submission', value: 'Today 09:14', color: 'text-emerald-600', icon: CheckCircle },
              { label: 'Schema Version', value: '3.5', color: 'text-slate-600', icon: FileCode },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{s.label}</span>
                  <s.icon size={16} className={s.color} />
                </div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* XML preview card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Sub-tab bar */}
            <div className="flex items-center gap-0 border-b border-slate-200 px-4 pt-4">
              {[
                { key: 'str', label: 'STR' },
                { key: 'ctr', label: 'CTR / LCTR' },
              ].map(st => (
                <button
                  key={st.key}
                  onClick={() => setGoamlSubTab(st.key as 'str' | 'ctr')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors mr-2 ${
                    goamlSubTab === st.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 pb-2">
                <button
                  onClick={handleCopyXml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Copy size={13} />
                  {copied ? 'Copied!' : 'Copy XML'}
                </button>
                <button
                  onClick={handleDownloadXml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Download size={13} />
                  Download XML
                </button>
              </div>
            </div>

            {/* XML code block */}
            <div className="p-4 bg-slate-900">
              {goamlLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader size={20} className="animate-spin mr-2" />
                  Loading live XML...
                </div>
              ) : (
                <pre className="text-green-300 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
                  <code>{goamlSubTab === 'str' ? goamlSample.sar_xml : goamlSample.ctr_xml}</code>
                </pre>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              Sample XML conforming to GoAML Schema v3.5 — FIU-IND (Financial Intelligence Unit India) • PMLA 2002, Section 12
            </div>
          </div>
        </div>
      )}

      {/* Batches Tab */}
      {tab === 'batches' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Job ID</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Job Name</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Started</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Duration</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Records</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Errors</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((job: any) => {
                  const st = statusConfig[job.status] || statusConfig.completed
                  const StatusIcon = st.icon
                  return (
                    <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{job.id}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-700">{job.name}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{job.category}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                          <StatusIcon size={11} className={job.status === 'running' ? 'animate-spin' : ''} />
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(job.started_at)}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-slate-600 font-mono">
                        {job.duration_seconds ? (
                          job.duration_seconds >= 60 ? `${Math.floor(job.duration_seconds / 60)}m ${job.duration_seconds % 60}s` : `${job.duration_seconds}s`
                        ) : (
                          <span className="text-amber-500">Running...</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">{formatNumber(job.records_processed)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        <span className={job.records_failed > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>{job.records_failed}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
