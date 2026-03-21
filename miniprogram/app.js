// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        traceUser: true,
      });
    }

    // 初始化数据库
    this.db = wx.cloud.database();
  },
});
