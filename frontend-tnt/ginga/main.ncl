<ncl>
  <head>
    <regionBase>
      <region id="main" width="100%" height="100%" />
    </regionBase>
    <descriptorBase>
      <descriptor id="title" region="main" x="100" y="50" width="500" height="50" font="Arial" size="24" color="white" />
      <descriptor id="button" region="main" x="100" y="150" width="300" height="50" />
    </descriptorBase>
  </head>
  <body>
    <port id="start" component="main_menu" />
    <media id="main_menu" src="scripts/main_menu.lua" />
  </body>
</ncl>