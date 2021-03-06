import React, { useEffect, useState } from 'react';
import BlogContainer from '../components/BlogContainer/BlogContainer';
import Marquee from '../components/Marquee/Marquee';
import MessageBoard from '../components/MessageBoard/MessageBoard';
import { getOneHit, getCommentsByHit } from '../utils/API';
import { useParams } from 'react-router-dom';
import { useUserProvider } from '../utils/UserProvider';
import LoginForm from '../components/LoginForm/LoginForm';

function Blog() {
  const { user, setUser } = useUserProvider();
  const [hit, setHit] = useState({
    Comments: [],
    company: {}
  });

  const { id } = useParams();
  useEffect(async () => {
    try {
      const res = await getOneHit(id);
      const hitData = res?.data?.[0];
      const comments = await getCommentsByHit(id);
      if (hitData && comments) {
        hitData.Comments = comments.data;
        setHit(hitData);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  if (user.id) {
    return (
      <BlogContainer hit={hit} setHit={setHit}>
        <Marquee />
        {/* <MessageBoard /> */}
      </BlogContainer>
    );
  } else {
    return <LoginForm />;
  }
}

export default Blog;
