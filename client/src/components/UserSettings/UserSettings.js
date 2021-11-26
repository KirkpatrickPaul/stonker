import React, { Component } from 'react';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Comment from '../Comment/Comment';

const UserSettings = ({ userInfo, setUserInfo }) => {
  console.log('userInfo :>> ', userInfo);
  return (
    <Container>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <div>Username: {userInfo.username}</div>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UserSettings;
