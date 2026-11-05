import { useNavigate, useSearchParams } from 'react-router-dom';
import POSInterface from '../POS/POSInterface';

const CommercialPOS = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');

  // Use the existing POS interface but ensure it's in commercial mode
  return (
    <div>
      <POSInterface />
    </div>
  );
};

export default CommercialPOS;

