import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ModelBreakdown {
  name: string;
  count: number;
  percentage: number;
}

interface ChartDataItem {
  provider: string;
  totalModels: number;
  models: ModelBreakdown[];
}

interface Props {
  data: ChartDataItem[];
}

// Generate distinct colors for model stacks
const generateColors = (count: number) => {
  const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe',
    '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1', '#d084d0',
    '#87d068', '#ffc0cb', '#98fb98', '#f0e68c', '#dda0dd'
  ];
  return colors.slice(0, count);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    
    return (
      <div className="bg-white p-3 border rounded shadow-lg">
        <p className="font-semibold">{`Provider: ${label}`}</p>
        <p className="text-lg font-bold text-blue-600">{`Total Models: ${data?.totalModels || 0}`}</p>
      </div>
    );
  }
  return null;
};

export const ProviderModelChart: React.FC<Props> = ({ data }) => {
  // Simple chart data with just provider and total models
  const chartData = data.map(item => ({
    provider: item.provider,
    totalModels: item.totalModels
  }));

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="provider" 
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis label={{ value: 'Number of Models', angle: -90, position: 'insideLeft' }} />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar
            dataKey="totalModels"
            fill="#8884d8"
            name="Total Models"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};