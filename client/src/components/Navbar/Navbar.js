import React, { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import 'fontsource-roboto';
import './style.css';
import { useUserProvider } from '../../utils/UserProvider';
import { Link } from 'react-router-dom';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1
  },
  menuButton: {
    marginRight: theme.spacing(2)
  },
  title: {
    flexGrow: 1,
    fontWeight: 600,
    fontSize: '30pt'
  }
}));

function Navbar() {
  const classes = useStyles();
  const { user, setUser } = useUserProvider();
  useEffect(() => {}, user);

  return (
    <div className={classes.root}>
      <AppBar position='static' className='nav'>
        <Toolbar className='nav'>
          {/* <IconButton edge="start" color="inherit" aria-label="menu">
           <MenuIcon/>
          </IconButton> */}
          <Typography variant='h6' className={classes.title}>
            Stonker
          </Typography>
          <Button style={user.id ? {visiblity:"initial"} : {visibility:"hidden"}}>
            <Link
              to='/profile'
              className={
                window.location.pathname === '/' ||
                window.location.pathname === '/profile'
              }
            >
              User Profile
            </Link>
          </Button>

          <Button>
            <Link
              to='/'
              className={
                window.location.pathname === '/' ||
                window.location.pathname === '/login'
              }
            >
              {user.id ? 'Log Out' : 'Log In'}
            </Link>
          </Button>
        </Toolbar>
      </AppBar>
    </div>
  );
}

export default Navbar;
