import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {}

interface SalesMetrics {
  TOTAL_CUSTOMERS: number;
  TOTAL_ORDERS: number;
  TOTAL_REVENUE: number;
  AVG_ORDER_VALUE: number;
}

interface MonthlyData {
  MONTH: string;
  REVENUE: number;
  ORDERS: number;
  CUSTOMERS: number;
}

interface CategoryData {
  CATEGORY: string;
  REVENUE: number;
  ORDERS: number;
}

interface ProductData {
  PRODUCT_NAME: string;
  UNITS_SOLD: number;
  REVENUE: number;
}

const Dashboard: React.FC<DashboardProps> = () => {
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [productData, setProductData] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive state
  const [timePeriod, setTimePeriod] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  // Time period options (based on actual data: 2024-01 to 2024-06)
  const timePeriods = [
    { value: 'all', label: 'All 6 Months (Jan-Jun 2024)' },
    { value: 'q1', label: 'Q1 2024 (Jan-Mar)' },
    { value: 'q2', label: 'Q2 2024 (Apr-Jun)' },
    { value: 'recent3', label: 'Recent 3 Months (Apr-Jun)' },
    { value: 'early3', label: 'Early 3 Months (Jan-Mar)' }
  ];

  // Available categories (will be populated from API)
  const [availableCategories, setAvailableCategories] = useState<string[]>(['all']);

  // Data filtering functions
  const filterDataByTimePeriod = (data: MonthlyData[]) => {
    if (timePeriod === 'all') return data;
    
    return data.filter(item => {
      const month = item.MONTH;
      
      if (timePeriod === 'q1') {
        return ['2024-01', '2024-02', '2024-03'].includes(month);
      } else if (timePeriod === 'q2') {
        return ['2024-04', '2024-05', '2024-06'].includes(month);
      } else if (timePeriod === 'recent3') {
        return ['2024-04', '2024-05', '2024-06'].includes(month);
      } else if (timePeriod === 'early3') {
        return ['2024-01', '2024-02', '2024-03'].includes(month);
      }
      
      return true;
    });
  };

  useEffect(() => {
    const fetchDashboardData = async (isInitialLoad = false) => {
      try {
        console.log('🔄 Starting to fetch dashboard data...');
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setFilterLoading(true);
        }
        
        // Fetch all analytics data in parallel
        console.log('📡 Making API calls...');
        const [metricsRes, monthlyRes, categoryRes, productRes, categoriesRes] = await Promise.all([
          fetch(`/api/data?period=${timePeriod}&category=${selectedCategory}`),
          fetch(`/api/monthly-revenue?period=${timePeriod}&category=${selectedCategory}`),
          fetch(`/api/category-sales?period=${timePeriod}&category=${selectedCategory}`),
          fetch(`/api/top-products-by-category?category=${selectedCategory}&period=${timePeriod}`),
          fetch('/api/categories')
        ]);

        console.log('📊 API responses:', {
          metrics: metricsRes.status,
          monthly: monthlyRes.status,
          category: categoryRes.status,
          products: productRes.status,
          categories: categoriesRes.status
        });

        if (!metricsRes.ok || !monthlyRes.ok || !categoryRes.ok || !productRes.ok || !categoriesRes.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const [metrics, monthly, category, products, categories] = await Promise.all([
          metricsRes.json(),
          monthlyRes.json(),
          categoryRes.json(),
          productRes.json(),
          categoriesRes.json()
        ]);

        console.log('✅ Parsed data:', { metrics, monthly, category, products, categories });
        console.log('🎯 Metrics data:', metrics.data);
        console.log('📊 Time period:', timePeriod);

        setSalesMetrics(metrics.data);
        setMonthlyData(monthly.data || []);
        setCategoryData(category.data || []);
        setProductData(products.data || []);

        // Populate available categories from dedicated endpoint (not from chart data)
        if (categories.data) {
          const categoryOptions = ['all', ...categories.data.map((item: any) => item.CATEGORY)];
          setAvailableCategories(categoryOptions);
        }
        
        setError(null);
        console.log('🎯 State updated successfully');
        
      } catch (err) {
        console.error('❌ Dashboard data fetch error:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
        setFilterLoading(false);
      }
    };

    // Check if this is the initial load
    const isInitialLoad = salesMetrics === null;
    fetchDashboardData(isInitialLoad);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, timePeriod]); // Re-fetch when category or time period changes

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2>📊 Business Data Catalog</h2>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading data catalog...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2>📊 Business Data Catalog</h2>
        <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
          <div>{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '10px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'relative' }}>
      {filterLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2em', marginBottom: '10px' }}>🔄</div>
            <div style={{ fontSize: '0.9em', color: '#6c757d' }}>Updating dashboard...</div>
          </div>
        </div>
      )}
      <h2>📊 Business Data Catalog</h2>
      <p>Real-time data insights powered by Snowflake</p>

      {/* Filters */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px', 
        marginBottom: '25px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        opacity: filterLoading ? 0.7 : 1,
        transition: 'opacity 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.9em', fontWeight: '600', color: '#495057', whiteSpace: 'nowrap' }}>
            📅 Time Period:
          </label>
          <select 
            value={timePeriod} 
            onChange={(e) => setTimePeriod(e.target.value)}
            disabled={filterLoading}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ced4da',
              fontSize: '0.9em',
              flex: 1,
              cursor: filterLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {timePeriods.map(period => (
              <option key={period.value} value={period.value}>{period.label}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.9em', fontWeight: '600', color: '#495057', whiteSpace: 'nowrap' }}>
            🏷️ Category:
          </label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={filterLoading}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ced4da',
              fontSize: '0.9em',
              flex: 1,
              cursor: filterLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {availableCategories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
        
        {filterLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8em', color: '#6c757d', fontStyle: 'italic' }}>
            <span>🔄</span>
            <span>Updating dashboard...</span>
          </div>
        )}
      </div>
      
      {/* Key Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #007bff', textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>{salesMetrics?.TOTAL_CUSTOMERS || 0}</div>
          <div style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
            {selectedCategory !== 'all' ? `${selectedCategory} Customers` : 'Total Customers'}
          </div>
          <div style={{ fontSize: '0.8em', fontWeight: 'bold', color: (timePeriod !== 'all' || selectedCategory !== 'all') ? '#dc3545' : '#28a745' }}>
            {(timePeriod !== 'all' || selectedCategory !== 'all') ? `Filtered View` : '+12% this month'}
          </div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #007bff', textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>{salesMetrics?.TOTAL_ORDERS || 0}</div>
          <div style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
            {selectedCategory !== 'all' ? `${selectedCategory} Orders` : 'Total Orders'}
          </div>
          <div style={{ fontSize: '0.8em', fontWeight: 'bold', color: (timePeriod !== 'all' || selectedCategory !== 'all') ? '#dc3545' : '#28a745' }}>
            {(timePeriod !== 'all' || selectedCategory !== 'all') ? `Filtered View` : '+8% this month'}
          </div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #007bff', textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>${(salesMetrics?.TOTAL_REVENUE || 0).toLocaleString()}</div>
          <div style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
            {selectedCategory !== 'all' ? `${selectedCategory} Revenue` : 'Total Revenue'}
          </div>
          <div style={{ fontSize: '0.8em', fontWeight: 'bold', color: (timePeriod !== 'all' || selectedCategory !== 'all') ? '#dc3545' : '#28a745' }}>
            {(timePeriod !== 'all' || selectedCategory !== 'all') ? `Filtered View` : '+15% this month'}
          </div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #007bff', textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>${(salesMetrics?.AVG_ORDER_VALUE || 0).toFixed(2)}</div>
          <div style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
            {selectedCategory !== 'all' ? `${selectedCategory} Avg Order` : 'Avg Order Value'}
          </div>
          <div style={{ fontSize: '0.8em', fontWeight: 'bold', color: (timePeriod !== 'all' || selectedCategory !== 'all') ? '#dc3545' : '#28a745' }}>
            {(timePeriod !== 'all' || selectedCategory !== 'all') ? `Filtered View` : '+2.3% this month'}
          </div>
        </div>
      </div>

      {/* Monthly Revenue Trend */}
      <div style={{ marginTop: '30px' }}>
        <h3>📊 {selectedCategory !== 'all' ? `${selectedCategory} ` : ''}Monthly Revenue Trend ({timePeriods.find(p => p.value === timePeriod)?.label})</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filterDataByTimePeriod(monthlyData)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="MONTH" />
            <YAxis />
            <Tooltip formatter={(value, name) => [
              name === 'Revenue' ? `$${Number(value).toLocaleString()}` : value,
              name === 'Revenue' ? 'Revenue' : name === 'Customers' ? 'Customers' : 'Count'
            ]} />
            <Legend />
            <Line type="monotone" dataKey="REVENUE" stroke="#8884d8" strokeWidth={2} name="Revenue" />
            <Line type="monotone" dataKey="CUSTOMERS" stroke="#82ca9d" strokeWidth={2} name="Customers" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Grid */}
      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3>📈 Top Products{selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={productData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="PRODUCT_NAME" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="REVENUE" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3>🍕 {selectedCategory === 'all' ? 'Sales by Category' : `${selectedCategory} Products`}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ CATEGORY, percent }) => `${CATEGORY} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="REVENUE"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Status */}
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
        <strong>🎛️ Active Filters:</strong> 
        {timePeriod !== 'all' && <span style={{ margin: '0 5px', padding: '4px 8px', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', fontSize: '0.85em' }}>
          📅 {timePeriods.find(p => p.value === timePeriod)?.label}
        </span>}
        {selectedCategory !== 'all' && <span style={{ margin: '0 5px', padding: '4px 8px', backgroundColor: '#28a745', color: 'white', borderRadius: '4px', fontSize: '0.85em' }}>
          🏷️ {selectedCategory}
        </span>}
        {(timePeriod === 'all' && selectedCategory === 'all') && <span style={{ color: '#6c757d', fontStyle: 'italic' }}>No filters applied - showing all data</span>}
      </div>


    </div>
  );
};

export default Dashboard;

