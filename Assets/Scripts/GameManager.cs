using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public Text livesText;

    public Text scoreText;

    public Text highScoreText;

    public bool gameOver;

    public GameObject gameOverPanel;

    public Transform brick;

    public Camera mainCamera;

    GameObject[,] bricks;

    int numberOfBricks;

    int countX;

    int countY;

    int startX;

    int startY;

    int lives;

    int score;

    // Start is called before the first frame update
    void Start()
    {
        lives = 3;
        score = 0;
        InitializeBrickArrangementMetadata();
        BuildNewBrickArrangement();
        UpdateLivesText();
        UpdateScoreText();
    }

    // Update is called once per frame
    void Update()
    {

    }

    public void PlayAgain()
    {
        SceneManager.LoadScene("MainScene");
    }

    public void Quit()
    {
        SceneManager.LoadScene("HomeScene");
    }

    public void UpdateLives(int value)
    {
        lives += value;
        if (lives <= 0)
        {
            lives = 0;
            GameOver();
        }
        UpdateLivesText();
    }

    public void UpdateScore(int value)
    {
        score += value;
        UpdateScoreText();
    }

    public void UpdateNumberOfBricks()
    {
        numberOfBricks--;
        if (numberOfBricks <= 0)
        {
            BuildNewBrickArrangement();
        }
    }

    void InitializeBrickArrangementMetadata()
    {
        Random.InitState((int)System.DateTimeOffset.Now.ToUnixTimeMilliseconds());
        Vector3 bottomLeft = mainCamera.ViewportToWorldPoint(new Vector3(0, 0, -10));
        Vector3 topRight = mainCamera.ViewportToWorldPoint(new Vector3(1, 1, -10));
        countX = (int)Mathf.Floor(topRight.x - bottomLeft.x) / 2 - 2;
        countY = (int)Mathf.Floor(topRight.y - bottomLeft.y) / 2 - 2;
        bricks = new GameObject[countX, countY];
        startX = -countX / 2;
        startY = 1;
    }

    void BuildNewBrickArrangement()
    {
        numberOfBricks = (int)Mathf.Floor(Random.Range(Mathf.Floor(countX * countY * 0.4f), Mathf.Floor(countX * countY * 0.7f)));
        for (int i = 0; i < numberOfBricks; i++)
        {
            int x = Random.Range(0, countX);
            int y = Random.Range(0, countY);
            int point = Random.Range(1, 5);
            AddBrick(x, y, point);
        }
    }

    void AddBrick(int x, int y, int point)
    {
        int initialX = x, initialY = y;
        brick.GetComponent<BrickScript>().point = point;
        while (x >= 0 && bricks[x, y] != null)
        {
            x--;
        }
        if (x < 0)
        {
            x = initialX;
            while (x < countX && bricks[x, y])
            {
                x++;
            }
            if (x >= countX)
            {
                x = initialX;
                while (y >= 0 && bricks[x, y] != null)
                {
                    y--;
                }
                if (y < 0)
                {
                    y = initialY;
                    while (y < countY && bricks[x, y] != null)
                    {
                        y++;
                    }
                }
            }
        }
        if (x >= 0 && x < countX && y >= 0 && y < countY)
        {
            bricks[x, y] = Instantiate(brick, new Vector2((x + startX) * 2, y + startY), Quaternion.identity).gameObject;
        }

    }

    void GameOver()
    {
        gameOver = true;
        UpdateHighScoreText();
        gameOverPanel.SetActive(true);
    }

    void UpdateLivesText()
    {
        livesText.text = "LIVES: " + lives;
    }

    void UpdateScoreText()
    {
        scoreText.text = "SCORE: " + score;
    }

    void UpdateHighScoreText()
    {
        if (!PlayerPrefs.HasKey("HIGHSCORE") || score > PlayerPrefs.GetInt("HIGHSCORE"))
        {
            PlayerPrefs.SetInt("HIGHSCORE", score);
            highScoreText.text = "WOOHOO!!! HIGH SCORE: " + PlayerPrefs.GetInt("HIGHSCORE");
        }
        else
        {
            highScoreText.text = "MAYBE NEXT TIME!!! YOUR SCORE: " + score;
        }
    }

}
