import cv2
import torch
import torch.nn as nn
import numpy as np


class CannyEdgeLossMean(nn.Module):
    def __init__(self):
        super().__init__()

    def forward(self, y_pred, y_true):

        y_pred = torch.mul(y_pred, 255).clamp(0, 255)
        y_true = torch.mul(y_true, 255).clamp(0, 255)

        p_canny = self.canny_edge_detection(y_pred)
        t_canny = self.canny_edge_detection(y_true)
        # Mean
        loss = torch.mean(torch.abs((p_canny-t_canny)/255))

        return loss

    def canny_edge_detection(self, img):
        img = img.permute(0, 2, 3, 1).cpu().detach().numpy().astype('uint8')
        canny = torch.tensor(
            np.array([cv2.Canny(arr, 75, 200) for arr in img]))
        return canny.float()


class SobelLossMean(nn.Module):
    def __init__(self):
        super().__init__()

    def sobel_xy(self, img):
        img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        sobelx = cv2.convertScaleAbs(cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=1))
        sobely = cv2.convertScaleAbs(cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=1))
        sobelxy = cv2.addWeighted(sobelx, 0.5, sobely, 0.5, 0)
        return sobelxy

    def sobel_batch(self, imgs):
        imgs = imgs.permute(0, 2, 3, 1).cpu().detach().numpy().astype('uint8')
        sobel = torch.tensor(np.array([self.sobel_xy(img) for img in imgs]))
        return sobel.float()

    def forward(self, y_pred, y_true):
        y_pred = torch.mul(y_pred, 255).clamp(0, 255)
        y_true = torch.mul(y_true, 255).clamp(0, 255)
        p_sobel = self.sobel_batch(y_pred)
        t_sobel = self.sobel_batch(y_true)
        loss = torch.mean(torch.abs((p_sobel-t_sobel)/255))

        return loss


class ColorSobelLossMean(nn.Module):
    def __init__(self):
        super().__init__()

    def sobel_xy(self, img):
        img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        sobelx = cv2.convertScaleAbs(cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=1))
        sobely = cv2.convertScaleAbs(cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=1))
        sobelxy = cv2.addWeighted(sobelx, 0.5, sobely, 0.5, 0)
        return sobelxy

    def extract_color_area(self, sobelxy, rgb_img):
        _, mask = cv2.threshold(sobelxy, 10, 255, cv2.THRESH_BINARY)
        sobelxy_smooth = cv2.GaussianBlur(mask, (3, 3), 0)
        masked_image = cv2.bitwise_and(rgb_img, rgb_img, mask=sobelxy_smooth)
        return masked_image

    def color_sobel_batch(self, imgs):
        imgs = imgs.permute(0, 2, 3, 1).cpu().detach().numpy().astype('uint8')
        sobel_arr = [self.sobel_xy(img) for img in imgs]
        color_edge_arr = [self.extract_color_area(
            sobelxy, img) for (sobelxy, img) in zip(sobel_arr, imgs)]
        sobel = torch.tensor(np.array(sobel_arr))
        color_edge = torch.tensor(np.array(color_edge_arr))
        return sobel.float(), color_edge.float()

    def forward(self, y_pred, y_true):
        y_pred = torch.mul(y_pred, 255).clamp(0, 255)
        y_true = torch.mul(y_true, 255).clamp(0, 255)
        p_sobel, p_color_edge = self.color_sobel_batch(y_pred)
        t_sobel, t_color_edge = self.color_sobel_batch(y_true)
        loss_sobel = torch.mean(torch.abs((p_sobel-t_sobel)/255))
        loss_color_edge = torch.mean(
            torch.abs((p_color_edge-t_color_edge)/255))

        return loss_sobel, loss_color_edge
