import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { Users, Briefcase } from 'lucide-react';

const ClientsList = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/crm/clients');
      setClients(response.data.data || []);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة العملاء</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة العملاء والعلاقات التجارية</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا يوجد عملاء</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">الاسم</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">البريد</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الهاتف</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">إجمالي الطلبات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">إجمالي الإنفاق</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 font-medium">{client.name}</td>
                    <td className="py-3 px-4">{client.email}</td>
                    <td className="py-3 px-4">{client.phone || '-'}</td>
                    <td className="py-3 px-4">{client.totalOrders || 0}</td>
                    <td className="py-3 px-4">{client.totalSpent || 0} TND</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientsList;

