const app = getApp();
const DB_NAME = "guests";
const DEFAULT_AVATAR = "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQ62ib7Yg691g7b2ibv7ibv7ibv7ibv7ibv7ibv7ibv7ibv7ibv7ibv7ib/640";

Page({
  data: {
    guestId: "",
    guest: null,
    name: "",
    avatarUrl: "",
    tempAvatarPath: "",
    uploading: false,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ guestId: options.id });
      this.loadGuestDetail();
    } else {
      wx.showToast({
        title: "参数错误",
        icon: "none",
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载客人详情
  async loadGuestDetail() {
    try {
      wx.showLoading({ title: "加载中..." });
      const db = app.db;
      const result = await db.collection(DB_NAME).doc(this.data.guestId).get();
      const guest = result.data;

      if (guest.deleted) {
        wx.showToast({
          title: "该客人已被删除",
          icon: "none",
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      this.setData({
        guest: guest,
        name: guest.name,
        avatarUrl: guest.avatarUrl || "",
      });
    } catch (e) {
      console.error("加载详情失败", e);
      wx.showToast({
        title: "加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 输入姓名
  onNameInput(e) {
    this.setData({
      name: e.detail.value,
    });
  },

  // 选择头像
  chooseAvatar() {
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
              tempAvatarPath: tempFilePath,
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

  // 保存修改
  async saveEdit() {
    const name = this.data.name.trim();
    if (!name) {
      wx.showToast({
        title: "请输入客人姓名",
        icon: "none",
      });
      return;
    }

    const guest = this.data.guest;
    if (name === guest.name && !this.data.tempAvatarPath) {
      wx.navigateBack();
      return;
    }

    try {
      wx.showLoading({ title: "保存中..." });
      const db = app.db;

      // 如果有新头像，先上传
      let avatarUrl = this.data.avatarUrl;
      if (this.data.tempAvatarPath) {
        this.setData({ uploading: true });
        avatarUrl = await this.uploadImage(this.data.tempAvatarPath);
      }

      // 检查是否有重名（排除自己）
      if (name !== guest.name) {
        const existRes = await db.collection(DB_NAME)
          .where({
            name: name,
            deleted: db.command.neq(true),
          })
          .get();

        const hasDuplicate = existRes.data && existRes.data.some(item => item._id !== guest._id);

        if (hasDuplicate) {
          wx.hideLoading();
          wx.showModal({
            title: "客人已存在",
            content: `客人「${name}」已存在，确定还要修改吗？`,
            success: async (res) => {
              if (res.confirm) {
                await this.doUpdateGuest(name, avatarUrl);
              }
            },
          });
          return;
        }
      }

      await this.doUpdateGuest(name, avatarUrl);
    } catch (e) {
      console.error("修改失败", e);
      wx.hideLoading();
      wx.showToast({
        title: "操作失败: " + (e.errMsg || e.message),
        icon: "none",
      });
    }
  },

  // 执行更新客人信息
  async doUpdateGuest(name, avatarUrl) {
    try {
      const db = app.db;
      const updateData = {
        name: name,
        updateTime: db.serverDate(),
      };
      if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      const result = await db.collection(DB_NAME).doc(this.data.guestId).update({
        data: updateData,
      });

      wx.hideLoading();

      if (result.stats.updated === 0) {
        wx.showToast({
          title: "未更新任何数据",
          icon: "none",
        });
        return;
      }

      wx.showToast({
        title: "修改成功",
        icon: "success",
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (e) {
      wx.hideLoading();
      throw e;
    }
  },

  // 取消编辑
  cancelEdit() {
    wx.navigateBack();
  },
});
