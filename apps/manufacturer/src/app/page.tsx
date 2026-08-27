import { redirect } from 'next/navigation';

/** The manufacturer surface starts at the dashboard. */
const HomePage = () => {
  redirect('/dashboard');
};

export default HomePage;
