/**
 * Diagnostic utilities to check geographic heatmap data consistency
 */
import api from '../config/api'

export async function diagnoseGeoRiskCounts() {
  try {
    // Get geo-risk data
    const geoResp = await api.get('/dashboard/geo-risk')
    const delhi = geoResp.data.states.find((s: any) => s.state === 'Delhi')
    
    // Get customer list with filter
    const custResp = await api.get('/customers', { 
      params: { state: 'Delhi', risk_category: 'high', page_size: 100 } 
    })
    
    // Get drill-down endpoint data
    const drillResp = await api.get('/dashboard/geo-risk/Delhi/customers', {
      params: { risk_category: 'high', page_size: 100 }
    })
    
    const report = {
      'Geo-risk (summary)': delhi?.high_risk_count ?? 'N/A',
      'Customers list (filtered)': custResp.data.total ?? 'N/A',
      'Drill-down endpoint': drillResp.data.total ?? 'N/A',
      'Match': (delhi?.high_risk_count === custResp.data.total && 
                custResp.data.total === drillResp.data.total) ? 'YES' : 'NO'
    }
    
    console.table(report)
    return report
  } catch (err) {
    console.error('Diagnostic error:', err)
    throw err
  }
}
