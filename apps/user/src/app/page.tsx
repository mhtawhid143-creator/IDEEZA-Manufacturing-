import { redirect } from 'next/navigation';

/** The buyer surface starts at the manufacturing hub. */
const HomePage = () => {
  redirect('/manufacturing');
};

export default HomePage;
