import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { Settings, Clock, CheckCircle, XCircle } from 'lucide-react';

const JobQueue = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs');
      setJobs(response.data.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">قائمة المهام</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">مراقبة المهام في الخلفية</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Settings className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد مهام</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">المهمة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">النوع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الحالة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">{job.name || job.id}</td>
                    <td className="py-3 px-4">{job.type || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-gold-100 text-gold-800 rounded-full text-xs">
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {job.createdAt ? new Date(job.createdAt).toLocaleDateString('fr-FR') : '-'}
                    </td>
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

export default JobQueue;

