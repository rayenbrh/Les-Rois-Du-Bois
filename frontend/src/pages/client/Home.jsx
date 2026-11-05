import { useEffect, useState } from 'react';
import clientApi from '../../utils/clientAxios';
import api from '../../utils/axios';
import { useAuth } from '../../contexts/AuthContext';
import Hero from '../../components/landing/Hero';
import TopSellers from '../../components/landing/TopSellers';
import Categories from '../../components/landing/Categories';
import CTA from '../../components/landing/CTA';

const listOf = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

const Home = () => {
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Re-fetch when the account changes so prices match the viewer (détail / gros)
  useEffect(() => {
    let active = true;
    const load = async () => {
      // Curated homepage lists first, automatic lists as fallback
      const [featured, top, cats] = await Promise.allSettled([
        api.get('/homepage/featured', { params: { limit: 12 } }),
        api.get('/homepage/top-sellers', { params: { limit: 12 } }),
        clientApi.get('/categories'),
      ]);

      let featuredList = featured.status === 'fulfilled' ? listOf(featured.value) : [];
      let topList = top.status === 'fulfilled' ? listOf(top.value) : [];

      const fallbacks = await Promise.allSettled([
        featuredList.length ? null : clientApi.get('/products/new', { params: { limit: 10 } }),
        topList.length ? null : clientApi.get('/products/top-selling', { params: { limit: 10 } }),
      ]);
      if (!featuredList.length && fallbacks[0].status === 'fulfilled') featuredList = listOf(fallbacks[0].value);
      if (!topList.length && fallbacks[1].status === 'fulfilled') topList = listOf(fallbacks[1].value);

      if (!active) return;
      setNewProducts(featuredList);
      setTopSellingProducts(topList);
      setCategories(cats.status === 'fulfilled' ? listOf(cats.value) : []);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [user?._id, user?.role]);

  return (
    <div>
      <Hero />
      <TopSellers products={topSellingProducts} featuredProducts={newProducts} loading={loading} />
      <Categories categories={categories} loading={loading} />
      <CTA />
    </div>
  );
};

export default Home;
