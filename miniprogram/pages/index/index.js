const app = getApp();
const DB_NAME = "guests";

Page({
  data: {
    allGuestList: [],
    guestList: [],
    showAdd: false,
    showActions: false,
    newGuestName: "",
    selectedGuest: null,
    searchKeyword: "",
    tempAddAvatarPath: "",
    adding: false,
  },

  onLoad() {
    this.loadGuests();
  },

  onShow() {
    this.loadGuests();
  },

  // 加载客人列表
  async loadGuests() {
    try {
      wx.showLoading({ title: "加载中..." });
      const db = app.db;
      const result = await db.collection(DB_NAME)
        .where({
          deleted: db.command.neq(true),
        })
        .orderBy("currentCount", "desc")
        .get();
      const allGuestList = result.data || [];
      this.setData({
        allGuestList: allGuestList,
      });
      this.filterGuests();
    } catch (e) {
      console.error("加载客人列表失败", e);
      wx.showToast({
        title: "加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.filterGuests();
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchKeyword: "" });
    this.filterGuests();
  },

  // 过滤客人
  filterGuests() {
    const { allGuestList, searchKeyword } = this.data;
    if (!searchKeyword || !searchKeyword.trim()) {
      this.setData({ guestList: allGuestList });
      return;
    }

    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = allGuestList.filter((guest) => {
      return guest.name && guest.name.toLowerCase().includes(keyword);
    });
    this.setData({ guestList: filtered });
  },

  // 显示添加客人弹窗
  showAddModal() {
    this.setData({
      showAdd: true,
      newGuestName: "",
      tempAddAvatarPath: "",
    });
  },

  // 隐藏添加客人弹窗
  hideAddModal() {
    this.setData({
      showAdd: false,
      newGuestName: "",
      tempAddAvatarPath: "",
    });
  },

  // 选择添加客人的头像
  chooseAddAvatar() {
    wx.showActionSheet({
      itemList: ["拍照", "从相册选择"],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ["camera"] : ["album"];
        wx.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: sourceType,
          success: (chooseRes) => {
            const tempFilePath = chooseRes.tempFilePaths[0];
            this.setData({
              tempAddAvatarPath: tempFilePath,
            });
          },
        });
      },
    });
  },

  // 上传图片到云存储
  async uploadImage(filePath) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const cloudPath = `avatars/${timestamp}_${random}.jpg`;

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
      });
      return uploadRes.fileID;
    } catch (e) {
      console.error("上传图片失败", e);
      throw e;
    }
  },

  // 输入客人姓名
  onNameInput(e) {
    this.setData({
      newGuestName: e.detail.value,
    });
  },

  // 添加客人
  async addGuest() {
    const name = this.data.newGuestName.trim();
    if (!name) {
      wx.showToast({
        title: "请输入客人姓名",
        icon: "none",
      });
      return;
    }

    try {
      wx.showLoading({ title: "检查中..." });
      const db = app.db;

      // 检查客人姓名是否已存在
      const existRes = await db.collection(DB_NAME)
        .where({
          name: name,
          deleted: db.command.neq(true),
        })
        .get();

      wx.hideLoading();

      // 如果已存在，提示确认
      if (existRes.data && existRes.data.length > 0) {
        wx.showModal({
          title: "客人已存在",
          content: `客人「${name}」已存在，确定还要添加吗？`,
          success: async (res) => {
            if (res.confirm) {
              await this.doAddGuest(name);
            }
          },
        });
      } else {
        // 不存在，直接添加
        await this.doAddGuest(name);
      }
    } catch (e) {
      console.error("检查客人失败", e);
      wx.hideLoading();
      wx.showToast({
        title: "操作失败",
        icon: "none",
      });
    }
  },

  // 执行添加客人
  async doAddGuest(name) {
    try {
      this.setData({ adding: true });
      wx.showLoading({ title: "添加中..." });
      const db = app.db;

      // 如果有头像，先上传
      let avatarUrl = "";
      if (this.data.tempAddAvatarPath) {
        avatarUrl = await this.uploadImage(this.data.tempAddAvatarPath);
      }

      const guestData = {
        name: name,
        currentCount: 0,
        totalCount: 0,
        rewardCount: 0,
        visitHistory: [], // 每次光临时间记录
        rewardHistory: [], // 每次奖励发放时间记录
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      };

      if (avatarUrl) {
        guestData.avatarUrl = avatarUrl;
      }

      await db.collection(DB_NAME).add({
        data: guestData,
      });

      wx.showToast({
        title: "添加成功",
        icon: "success",
      });
      this.hideAddModal();
      this.loadGuests();
    } catch (e) {
      console.error("添加客人失败", e);
      wx.showToast({
        title: "添加失败",
        icon: "none",
      });
    } finally {
      this.setData({ adding: false });
      wx.hideLoading();
    }
  },

  // 显示客人操作弹窗
  showGuestActions(e) {
    const guest = e.currentTarget.dataset.guest;
    this.setData({
      showActions: true,
      selectedGuest: guest,
    });
  },

  // 隐藏客人操作弹窗
  hideGuestActions() {
    this.setData({
      showActions: false,
      selectedGuest: null,
    });
  },

  // 跳转到详情页
  goToDetail() {
    const guest = this.data.selectedGuest;
    wx.navigateTo({
      url: `/pages/detail/index?id=${guest._id}`,
    });
    this.hideGuestActions();
  },

  // 跳转到编辑页面
  goToEdit() {
    const guest = this.data.selectedGuest;
    wx.navigateTo({
      url: `/pages/edit/index?id=${guest._id}`,
    });
    this.hideGuestActions();
  },

  // 光临次数-1
  async decrementCount() {
    const guest = this.data.selectedGuest;
    if (guest.currentCount <= 0) {
      wx.showToast({
        title: "当前次数已为0",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "确认撤销",
      content: "确定要撤销最近一次光临记录吗？",
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: "更新中..." });
            const db = app.db;

            // 获取最新数据
            const guestRes = await db.collection(DB_NAME).doc(guest._id).get();
            const currentHistory = guestRes.data.visitHistory || [];

            // 移除最近一条记录
            const newHistory = currentHistory.slice(1);

            await db.collection(DB_NAME).doc(guest._id).update({
              data: {
                currentCount: db.command.inc(-1),
                totalCount: db.command.inc(-1),
                visitHistory: newHistory,
                updateTime: db.serverDate(),
              },
            });
            wx.showToast({
              title: "已撤销",
              icon: "success",
            });
            this.hideGuestActions();
            this.loadGuests();
          } catch (e) {
            console.error("更新次数失败", e);
            wx.showToast({
              title: "更新失败",
              icon: "none",
            });
          } finally {
            wx.hideLoading();
          }
        }
      },
    });
  },

  // 删除客人
  deleteGuest() {
    const guest = this.data.selectedGuest;
    wx.showModal({
      title: "确认删除",
      content: `确定要删除客人「${guest.name}」吗？此操作不可恢复。`,
      confirmColor: "#e54545",
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: "删除中..." });
            const db = app.db;
            await db.collection(DB_NAME).doc(guest._id).update({
              data: {
                deleted: true,
                deleteTime: db.serverDate(),
                updateTime: db.serverDate(),
              },
            });
            wx.showToast({
              title: "已删除",
              icon: "success",
            });
            this.hideGuestActions();
            this.loadGuests();
          } catch (e) {
            console.error("删除失败", e);
            wx.showToast({
              title: "删除失败",
              icon: "none",
            });
          } finally {
            wx.hideLoading();
          }
        }
      },
    });
  },

  // 光临次数+1
  async incrementCount() {
    const guest = this.data.selectedGuest;
    try {
      wx.showLoading({ title: "更新中..." });
      const db = app.db;

      // 添加本次光临时间
      const now = new Date();
      const newVisit = {
        time: db.serverDate(),
        timeStr: this.formatDate(now),
      };

      await db.collection(DB_NAME).doc(guest._id).update({
        data: {
          currentCount: db.command.inc(1),
          totalCount: db.command.inc(1),
          visitHistory: db.command.unshift(newVisit), // 新记录加到前面
          updateTime: db.serverDate(),
        },
      });
      wx.showToast({
        title: "记录成功",
        icon: "success",
      });
      this.hideGuestActions();
      this.loadGuests();
    } catch (e) {
      console.error("更新次数失败", e);
      wx.showToast({
        title: "更新失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 格式化日期
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const w = weekdays[date.getDay()];
    return `${y}-${m}-${d} ${w} ${h}:${min}`;
  },

  // 发放奖励
  async giveReward() {
    const guest = this.data.selectedGuest;
    if (guest.currentCount < 10) {
      wx.showToast({
        title: "光临次数未满10次",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "确认发放奖励",
      content: `确定给「${guest.name}」发放奖励吗？\n本次 ${guest.currentCount} 次将清零并重新开始计数。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: "发放中..." });
            const db = app.db;

            // 记录奖励发放时间
            const now = new Date();
            const newReward = {
              time: db.serverDate(),
              timeStr: this.formatDate(now),
            };

            // 发放奖励：奖励次数+1，当前周期次数归零
            await db.collection(DB_NAME).doc(guest._id).update({
              data: {
                currentCount: 0,
                rewardCount: db.command.inc(1),
                rewardHistory: db.command.unshift(newReward),
                updateTime: db.serverDate(),
              },
            });

            wx.showToast({
              title: "奖励发放成功",
              icon: "success",
            });
            this.hideGuestActions();
            this.loadGuests();
          } catch (e) {
            console.error("发放奖励失败", e);
            wx.showToast({
              title: "发放失败",
              icon: "none",
            });
          } finally {
            wx.hideLoading();
          }
        }
      },
    });
  },

  // 阻止冒泡
  stopPropagation() {},
});
